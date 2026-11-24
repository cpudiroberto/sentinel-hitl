import { useEffect, useMemo, useRef, useState } from 'react';
import {
  computeSha256Hex,
  createIdempotencyGuard,
  createRateLimiter,
  escapeCsvCell,
  runQueryBenchmark,
  sanitizeNote,
} from '../engine/securityEngine';
import { playTone } from '../utils/audioEngine';

function buildSessionAuditPayload(events, metrics) {
  const latest = events[0];
  const latestTag = latest ? `${latest.id} (${latest.status})` : 'SIN-EVENTOS';
  return `SESION SENTINEL | Resueltos: ${metrics.totalResolved} | Protegido: ${metrics.protectedCapital} EUR | Ultimo: ${latestTag}`;
}

export default function DefenseLab({ isSpotlight, events = [], metrics }) {
  // Datos reales extraídos de la sesión activa de Sentinel HITL
  const sessionIps = useMemo(() => {
    const found = [];
    for (const evt of events) {
      if (evt.ip && !found.includes(evt.ip)) {
        found.push(evt.ip);
      }
      if (found.length === 2) break;
    }
    if (found.length === 0) return ['185.199.110.42', '91.214.124.8'];
    if (found.length === 1) return [found[0], '91.214.124.8'];
    return found;
  }, [events]);

  const latestAccessCase = useMemo(
    () => events.find((e) => e.type === 'ACCESS') || events[0] || null,
    [events]
  );

  const latestFinancialCase = useMemo(
    () =>
      events.find((e) => (Number(e.amount) || 0) > 0) || {
        id: 'EVT-DEMO',
        account: 'ES91 •••• 4821 (Tesorería Corp.)',
        amount: 1250,
        title: 'Transferencia corporativa',
      },
    [events]
  );

  const latestNotedCase = useMemo(
    () => events.find((e) => e.note) || events[0] || null,
    [events]
  );

  const sessionAccounts = useMemo(() => {
    const unique = [];
    for (const evt of events) {
      if (evt.account && !unique.includes(evt.account)) {
        unique.push(evt.account);
      }
    }
    return unique.length > 0
      ? unique
      : [
          'ES91 •••• 4821 (Tesorería)',
          'ES44 •••• 1093 (Operativa)',
          'ES21 •••• 3301 (RRHH)',
          'ES77 •••• 6510 (Liquidez)',
        ];
  }, [events]);

  // 1. Escudo HTTP 429 conectado a las IPs y cuentas de la sesión
  const limiterRef = useRef(
    createRateLimiter({ maxAttempts: 5, windowMs: 60000 })
  );
  const [selectedIpIdx, setSelectedIpIdx] = useState(0);
  const activeIp = sessionIps[selectedIpIdx] || sessionIps[0];
  const [loginStatus, setLoginStatus] = useState({
    status: 200,
    attempts: 0,
    maxAttempts: 5,
    retryAfterSec: 0,
    message: 'Puerta de acceso abierta para agentes.',
  });
  const [httpLogs, setHttpLogs] = useState([
    'Pulsa «1 intento» o «Ráfaga (6x)» para comprobar el bloqueo real HTTP 429.',
  ]);

  // 2. Benchmark Real N+1 en RAM
  const [benchSize, setBenchSize] = useState(15000);
  const [clientCount, setClientCount] = useState(40);
  const [benchmark, setBenchmark] = useState(() =>
    runQueryBenchmark(40, 15000)
  );

  // 3. Anti-XSS usando el mismo filtro que protege las notas de tus casos
  const [xssInput, setXssInput] = useState(
    '<script>alert("Robo de sesión")</script> Cliente verificado por teléfono'
  );

  // 4. Web Crypto API (SHA-256) sellando el estado REAL de la sesión
  const liveSessionString = useMemo(
    () => buildSessionAuditPayload(events, metrics),
    [events, metrics]
  );
  const initialPayloadRef = useRef(liveSessionString);
  const [cryptoPayload, setCryptoPayload] = useState(liveSessionString);
  const [sealedHash, setSealedHash] = useState('');
  const [currentHash, setCurrentHash] = useState('');

  // 5. Anti-CSRF + Idempotencia sobre una operación financiera real de la cola
  const idempGuardRef = useRef(createIdempotencyGuard());
  const [activeIdempKey, setActiveIdempKey] = useState(() =>
    idempGuardRef.current.generateKey()
  );
  const [idempLog, setIdempLog] = useState([
    'Pulsa «Ejecutar orden» dos veces seguidas para verificar cómo se bloquea el doble cobro (HTTP 409).',
  ]);

  // 6. Diagnóstico real del navegador (CSP, Referrer, Enlaces, WebCrypto y Excel CSV)
  const [auditChecks, setAuditChecks] = useState(null);
  const [cspViolations, setCspViolations] = useState(0);

  useEffect(() => {
    if (loginStatus.retryAfterSec <= 0) return undefined;
    const interval = setInterval(() => {
      setLoginStatus((prev) => {
        if (prev.retryAfterSec <= 1) {
          return {
            ...prev,
            status: 200,
            retryAfterSec: 0,
            message: 'Bloqueo finalizado. Acceso operativo de nuevo.',
          };
        }
        return { ...prev, retryAfterSec: prev.retryAfterSec - 1 };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [loginStatus.retryAfterSec]);

  useEffect(() => {
    let active = true;
    computeSha256Hex(initialPayloadRef.current).then((hex) => {
      if (active) setSealedHash(hex);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    computeSha256Hex(cryptoPayload).then((hex) => {
      if (active) setCurrentHash(hex);
    });
    return () => {
      active = false;
    };
  }, [cryptoPayload]);

  useEffect(() => {
    const onViolation = (e) => {
      setCspViolations((v) => v + 1);
      console.warn('[Sentinel CSP Blocked]', {
        directive: e.violatedDirective,
        blockedURI: e.blockedURI,
      });
    };
    document.addEventListener('securitypolicyviolation', onViolation);
    return () =>
      document.removeEventListener('securitypolicyviolation', onViolation);
  }, []);

  const handleSimulateLogin = (burst = false) => {
    const times = burst ? 6 : 1;
    let lastRes = null;
    const newLogs = [];
    const time = new Date().toLocaleTimeString('es-ES');
    const targetAcc = latestAccessCase?.account || 'admin.finanzas@empresa.es';
    for (let i = 0; i < times; i++) {
      lastRes = limiterRef.current.attempt();
      newLogs.unshift(
        `[${time}] ${activeIp} (${targetAcc}) → HTTP ${lastRes.status} ${lastRes.allowed ? 'PERMITIDO' : '429 BLOQUEADO'}`
      );
    }
    setLoginStatus({
      ...lastRes,
      message: lastRes.allowed
        ? `Acceso procesado (${lastRes.attempts}/${lastRes.maxAttempts} intentos en 60s)`
        : `BLOQUEO ACTIVO para ${activeIp}: HTTP 429 Too Many Requests`,
    });
    setHttpLogs((prev) => [...newLogs, ...prev].slice(0, 5));
    console.info('[Sentinel HTTP 429]', {
      sourceIp: activeIp,
      targetAccount: targetAcc,
      status: lastRes.status,
      attempts: lastRes.attempts,
      retryAfterSec: lastRes.retryAfterSec,
    });
    playTone(lastRes.allowed ? 'click' : 'error429');
  };

  const handleResetLimiter = () => {
    playTone('click');
    limiterRef.current.reset();
    setLoginStatus({
      status: 200,
      attempts: 0,
      maxAttempts: 5,
      retryAfterSec: 0,
      message: 'Ventana reiniciada. Acceso operativo.',
    });
    setHttpLogs(['Contador reiniciado. Listo para una nueva prueba.']);
  };

  const handleRunBenchmark = (newClients = clientCount, newSize = benchSize) => {
    playTone('verify');
    setClientCount(newClients);
    setBenchSize(newSize);
    const snap = runQueryBenchmark(newClients, newSize);
    setBenchmark(snap);
    console.groupCollapsed(
      `[Sentinel Benchmark] ${newSize.toLocaleString('es-ES')} ops · ${newClients} cuentas`
    );
    console.table({
      'Método lento (N+1)': {
        consultas: snap.nPlusOne.queries,
        iteraciones: snap.nPlusOne.iterations,
        latenciaMs: snap.nPlusOne.latencyMs,
      },
      'Método rápido (1 pasada Map)': {
        consultas: snap.aggregated.queries,
        iteraciones: snap.aggregated.iterations,
        latenciaMs: snap.aggregated.latencyMs,
      },
    });
    console.groupEnd();
  };

  const handleSealCrypto = async (customText) => {
    const textToSeal = typeof customText === 'string' ? customText : cryptoPayload;
    playTone('verify');
    const hex = await computeSha256Hex(textToSeal);
    setSealedHash(hex);
    setCurrentHash(hex);
    console.info('[Sentinel WebCrypto SHA-256]', {
      registroSellado: textToSeal,
      huellaSha256: hex,
    });
  };

  const handleSyncCryptoWithSession = () => {
    setCryptoPayload(liveSessionString);
    handleSealCrypto(liveSessionString);
  };

  const handleTamperCrypto = () => {
    playTone('error429');
    setCryptoPayload((prev) =>
      prev.includes('EUR')
        ? prev.replace(/(\d+)\s*EUR/, (_, n) => `${Number(n) + 1} EUR`)
        : `${prev} [+1 EUR]`
    );
  };

  const handleIdempotencyTest = (forgedCsrf = false) => {
    const res = idempGuardRef.current.execute({
      idempotencyKey: activeIdempKey,
      providedCsrf: forgedCsrf
        ? 'csrf_atacante_invalido'
        : idempGuardRef.current.getCsrfToken(),
      amount: latestFinancialCase.amount,
    });
    const time = new Date().toLocaleTimeString('es-ES');
    setIdempLog((prev) =>
      [
        `[${time}] ${latestFinancialCase.id} → HTTP ${res.status} · ${res.reason}`,
        ...prev,
      ].slice(0, 4)
    );
    console.info('[Sentinel Idempotency + CSRF]', {
      caseId: latestFinancialCase.id,
      account: latestFinancialCase.account,
      amountEur: latestFinancialCase.amount,
      idempotencyKey: activeIdempKey,
      csrfValid: !forgedCsrf,
      response: res,
    });
    playTone(res.ok ? 'approve' : 'error429');
  };

  const handleRunBrowserAudit = () => {
    playTone('verify');
    const cspMeta = document.querySelector(
      'meta[http-equiv="Content-Security-Policy"]'
    );
    const refMeta = document.querySelector('meta[name="referrer"]');
    const unsafeLinks = Array.from(
      document.querySelectorAll('a[target="_blank"]')
    ).filter((a) => !(a.rel || '').includes('noopener')).length;

    const testCsvInput = '=CMD|"calc"!A0';
    const testCsvOut = escapeCsvCell(testCsvInput);
    const csvSafe = testCsvOut.startsWith('"\'=');

    const report = [
      {
        control: 'Política CSP (bloqueo scripts)',
        estado: cspMeta ? 'ACTIVA' : 'AUSENTE',
        evidencia: cspMeta
          ? `${cspMeta.content.slice(0, 38)}...`
          : 'Sin etiqueta CSP',
      },
      {
        control: 'Privacidad de origen (Referrer)',
        estado: refMeta ? 'ACTIVA' : 'AUSENTE',
        evidencia: refMeta?.content || 'Por defecto',
      },
      {
        control: 'Enlaces externos seguros',
        estado: unsafeLinks === 0 ? 'SEGURO (0)' : `REVISAR (${unsafeLinks})`,
        evidencia: `${unsafeLinks} enlaces sin rel="noopener"`,
      },
      {
        control: 'Motor criptográfico SHA-256',
        estado: typeof crypto?.subtle !== 'undefined' ? 'ACTIVO' : 'FALLBACK',
        evidencia: window.isSecureContext ? 'Contexto seguro OK' : 'Entorno local',
      },
      {
        control: 'Protección fórmulas Excel (.CSV)',
        estado: csvSafe ? 'NEUTRALIZADA' : 'FALLO',
        evidencia: `${testCsvInput} → ${testCsvOut}`,
      },
    ];
    setAuditChecks(report);
    console.group('[Sentinel Live Security Audit]');
    console.table(report);
    console.groupEnd();
  };

  const cryptoIntact = Boolean(sealedHash && currentHash === sealedHash);
  const xssStrippedCount = (xssInput.match(/<[^>]*>/g) || []).length;

  return (
    <section className="animate-in">
      <div className="section-header-block">
        <span className="section-eyebrow mono">
          MÓDULO 02 · PRUEBAS EN VIVO SOBRE TU SESIÓN ACTUAL
        </span>
        <h2>Defensa Activa y Rendimiento Real</h2>
        <p>
          Cada tarjeta pone a prueba un mecanismo interno real de Sentinel HITL
          usando las cuentas, IPs e importes de tu propia sesión. Si abres{' '}
          <span className="mono">F12 → Console</span> verás las trazas técnicas
          en directo.
        </p>
      </div>

      <div className="lab-session-bar mono">
        <span>
          Datos conectados a tu sesión actual: <strong>{events.length}</strong>{' '}
          casos en memoria · <strong>{metrics.totalResolved}</strong> resueltos ·{' '}
          <strong>{metrics.protectedCapital.toLocaleString('es-ES')} €</strong>{' '}
          protegidos
        </span>
      </div>

      <div
        id="tour-lab-grid"
        className={`lab-grid ${isSpotlight ? 'tour-spotlight' : ''}`}
      >
        {/* 1. HTTP 429 */}
        <article className="card interactive-card">
          <div className="lab-kicker mono tone-critical">
            01 · PROTECCIÓN CONTRA FUERZA BRUTA (HTTP 429)
          </div>
          <h3 className="lab-card-title">Freno automático a intentos masivos</h3>
          <div className="lab-howto">
            <strong>Para qué sirve:</strong> Impide que un atacante pruebe
            contraseñas sin parar sobre{' '}
            <strong>{latestAccessCase?.account || 'cuentas de agentes'}</strong>.
            Pulsa «Ráfaga (6x)» y verás cómo al 6.º intento se bloquea la IP real
            de tu sesión durante 60 s.
          </div>

          <div className="inline-controls">
            {sessionIps.map((ip, idx) => (
              <button
                key={ip}
                className={selectedIpIdx === idx ? 'btn-primary' : 'btn-secondary'}
                style={{ padding: '0.32rem 0.65rem', fontSize: '0.78rem' }}
                onClick={() => {
                  playTone('click');
                  setSelectedIpIdx(idx);
                }}
              >
                IP sesión: {ip}
              </button>
            ))}
          </div>

          <div className="attempt-slots">
            {[1, 2, 3, 4, 5].map((n) => (
              <div
                key={n}
                className={`attempt-slot ${
                  loginStatus.status === 429
                    ? 'blocked'
                    : loginStatus.attempts >= n
                      ? 'used'
                      : ''
                }`}
              />
            ))}
          </div>

          <div className="http-log mono">
            {httpLogs.map((l, i) => (
              <div
                key={i}
                style={{ color: l.includes('429') ? '#f87171' : '#86efac' }}
              >
                {l}
              </div>
            ))}
          </div>

          {loginStatus.retryAfterSec > 0 && (
            <div
              className="mono"
              style={{
                marginBottom: '0.75rem',
                color: 'var(--danger)',
                fontWeight: 800,
              }}
            >
              IP BLOQUEADA · Reintento en {loginStatus.retryAfterSec}s
            </div>
          )}

          <div className="inline-controls">
            <button
              className="btn-danger"
              onClick={() => handleSimulateLogin(false)}
              disabled={loginStatus.status === 429}
            >
              1 intento ({loginStatus.attempts}/5)
            </button>
            <button
              className="btn-secondary"
              onClick={() => handleSimulateLogin(true)}
              disabled={loginStatus.status === 429}
            >
              Ráfaga (6x)
            </button>
            <button className="btn-secondary" onClick={handleResetLimiter}>
              Reiniciar
            </button>
          </div>
        </article>

        {/* 2. Benchmark Real N+1 */}
        <article className="card interactive-card">
          <div className="lab-kicker mono tone-ok">
            02 · VELOCIDAD DE AUDITORÍA (-{benchmark.reductionPct} % TIEMPO)
          </div>
          <h3 className="lab-card-title">
            Cálculo real de {benchSize.toLocaleString('es-ES')} operaciones
          </h3>
          <div className="lab-howto">
            <strong>Para qué sirve:</strong> Demuestra en tu propio procesador la
            diferencia entre revisar cuenta por cuenta (lento) o agrupar todo en
            una sola pasada. Ambos suman exactamente{' '}
            <strong className="mono">
              {benchmark.totalVolumeEur.toLocaleString('es-ES')} €
            </strong>
            .
          </div>

          <div className="bench-control-row">
            <span className="bench-control-label">Operaciones:</span>
            <div className="bench-btn-group">
              {[5000, 15000, 30000].map((sz) => (
                <button
                  key={sz}
                  className={benchSize === sz ? 'btn-primary' : 'btn-secondary'}
                  style={{ padding: '0.32rem 0.65rem', fontSize: '0.78rem' }}
                  onClick={() => handleRunBenchmark(clientCount, sz)}
                >
                  {(sz / 1000).toFixed(0)}k ops
                </button>
              ))}
            </div>
          </div>

          <div className="bench-control-row">
            <span className="bench-control-label">Cuentas:</span>
            <div className="bench-btn-group">
              {[20, 40, 80].map((n) => (
                <button
                  key={n}
                  className={clientCount === n ? 'btn-primary' : 'btn-secondary'}
                  style={{ padding: '0.32rem 0.65rem', fontSize: '0.78rem' }}
                  onClick={() => handleRunBenchmark(n, benchSize)}
                >
                  {n} cuentas
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: '0.75rem' }}>
            <div className="bench-row">
              <span>
                Lento N+1 ({benchmark.nPlusOne.iterations.toLocaleString('es-ES')}{' '}
                pasos)
              </span>
              <strong className="mono">{benchmark.nPlusOne.latencyMs} ms</strong>
            </div>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{ width: '100%', background: 'var(--danger)' }}
              />
            </div>

            <div className="bench-row">
              <span>
                Agrupado Map ({benchmark.aggregated.iterations.toLocaleString('es-ES')}{' '}
                pasos)
              </span>
              <strong className="mono" style={{ color: 'var(--success)' }}>
                {benchmark.aggregated.latencyMs} ms
              </strong>
            </div>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{
                  width: `${Math.max(
                    8,
                    Math.min(
                      100,
                      Math.round(
                        (benchmark.aggregated.latencyMs /
                          benchmark.nPlusOne.latencyMs) *
                          100
                      )
                    )
                  )}%`,
                  background: 'var(--success)',
                }}
              />
            </div>
          </div>

          <table className="sample-table mono">
            <thead>
              <tr>
                <th>Transacción</th>
                <th>Cuenta Sentinel</th>
                <th>Importe</th>
              </tr>
            </thead>
            <tbody>
              {benchmark.sampleRows.map((r, idx) => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>
                    {sessionAccounts[idx % sessionAccounts.length].slice(0, 18)}
                  </td>
                  <td>{r.amount} €</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>

        {/* 3. Anti-XSS */}
        <article className="card interactive-card">
          <div className="lab-kicker mono tone-accent">
            03 · LIMPIEZA DE NOTAS DE AUDITORÍA (ANTI-XSS)
          </div>
          <h3 className="lab-card-title">Bloqueo de código oculto en textos</h3>
          <div className="lab-howto">
            <strong>Para qué sirve:</strong> Es el filtro real que limpia cada
            nota que guardas al resolver un caso ({latestNotedCase?.id || 'EVT'}
            ). Prueba un ataque abajo y verás cómo elimina las etiquetas
            peligrosas al instante.
          </div>
          <div className="inline-controls">
            <button
              className="btn-secondary"
              style={{ padding: '0.3rem 0.6rem', fontSize: '0.76rem' }}
              onClick={() => {
                playTone('click');
                setXssInput(
                  `<script>fetch("https://evil.test")</script> Caso ${latestNotedCase?.id || 'EVT'} validado`
                );
              }}
            >
              Probar &lt;script&gt;
            </button>
            <button
              className="btn-secondary"
              style={{ padding: '0.3rem 0.6rem', fontSize: '0.76rem' }}
              onClick={() => {
                playTone('click');
                setXssInput(
                  '<img src=x onerror="stealCookie()"> Operación bloqueada'
                );
              }}
            >
              Probar &lt;img onerror&gt;
            </button>
            {latestNotedCase?.note && (
              <button
                className="btn-secondary"
                style={{ padding: '0.3rem 0.6rem', fontSize: '0.76rem' }}
                onClick={() => {
                  playTone('click');
                  setXssInput(latestNotedCase.note);
                }}
              >
                Usar mi última nota
              </button>
            )}
          </div>
          <input
            className="xss-input mono"
            value={xssInput}
            onChange={(e) => {
              setXssInput(e.target.value);
              console.info('[Sentinel Anti-XSS]', {
                raw: e.target.value,
                sanitized: sanitizeNote(e.target.value, 160),
              });
            }}
          />
          <div className="xss-safe-box">
            <div className="xss-safe-label">
              TEXTO SEGURO GUARDADO ({xssStrippedCount} etiquetas eliminadas):
            </div>
            <div className="mono" style={{ fontSize: '0.84rem' }}>
              {sanitizeNote(xssInput, 160) || '(vacío)'}
            </div>
          </div>
        </article>

        {/* 4. Criptografía SHA-256 sobre el estado real de la sesión */}
        <article className="card interactive-card">
          <div className="lab-kicker mono tone-accent">
            04 · SELLO INALTERABLE DE TU SESIÓN (SHA-256)
          </div>
          <h3 className="lab-card-title">Detección real de manipulaciones</h3>
          <div className="lab-howto">
            <strong>Para qué sirve:</strong> Crea una huella criptográfica real
            (Web Crypto API) del resumen de tus decisiones actuales. Si alguien
            altera solo 1 €, la huella se rompe y salta la alerta al instante.
          </div>
          <input
            className="xss-input mono"
            value={cryptoPayload}
            onChange={(e) => setCryptoPayload(e.target.value)}
          />
          <div className="hash-box mono">
            {currentHash || 'Calculando SHA-256...'}
          </div>
          <div className="lab-footer-row">
            <span
              className={`status-inline-text mono ${
                cryptoIntact ? 'tone-ok' : 'tone-critical'
              }`}
            >
              ● {cryptoIntact ? 'INTEGRIDAD VERIFICADA' : 'ALTERACIÓN DETECTADA'}
            </span>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              <button
                className="btn-secondary"
                style={{ padding: '0.38rem 0.65rem', fontSize: '0.76rem' }}
                onClick={handleSyncCryptoWithSession}
              >
                Cargar mi sesión
              </button>
              <button
                className="btn-secondary"
                style={{ padding: '0.38rem 0.65rem', fontSize: '0.76rem' }}
                onClick={handleTamperCrypto}
              >
                Alterar +1 €
              </button>
              <button
                className="btn-primary"
                style={{ padding: '0.38rem 0.72rem', fontSize: '0.76rem' }}
                onClick={() => handleSealCrypto()}
              >
                Sellar + F12
              </button>
            </div>
          </div>
        </article>

        {/* 5. Anti-CSRF + Idempotencia sobre una operación real de la sesión */}
        <article className="card interactive-card">
          <div className="lab-kicker mono tone-warn">
            05 · SEGURO CONTRA DOBLE COBRO (HTTP 409 / 403)
          </div>
          <h3 className="lab-card-title">
            Idempotencia sobre {latestFinancialCase.id}
          </h3>
          <div className="lab-howto">
            <strong>Para qué sirve:</strong> Evita que un doble clic ejecute dos
            veces la orden de{' '}
            <strong>
              {latestFinancialCase.amount.toLocaleString('es-ES')} €
            </strong>{' '}
            en <strong>{latestFinancialCase.account}</strong>, y rechaza órdenes
            sin token CSRF válido.
          </div>
          <div
            className="mono"
            style={{
              fontSize: '0.74rem',
              color: 'var(--text-muted)',
              marginBottom: '0.5rem',
            }}
          >
            Clave única: <strong>{activeIdempKey}</strong> · CSRF:{' '}
            <strong>{idempGuardRef.current.getCsrfToken()}</strong>
          </div>
          <div className="http-log mono">
            {idempLog.map((l, i) => (
              <div
                key={i}
                style={{ color: l.includes('201') ? '#86efac' : '#f87171' }}
              >
                {l}
              </div>
            ))}
          </div>
          <div className="inline-controls">
            <button
              className="btn-primary"
              onClick={() => handleIdempotencyTest(false)}
            >
              Ejecutar ({latestFinancialCase.amount.toLocaleString('es-ES')} €)
            </button>
            <button
              className="btn-danger"
              onClick={() => handleIdempotencyTest(true)}
            >
              CSRF falso
            </button>
            <button
              className="btn-secondary"
              onClick={() => {
                playTone('click');
                setActiveIdempKey(idempGuardRef.current.generateKey());
              }}
            >
              Nueva clave
            </button>
          </div>
        </article>

        {/* 6. Diagnóstico real de seguridad de esta web */}
        <article className="card interactive-card">
          <div className="lab-kicker mono tone-ok">
            06 · DIAGNÓSTICO DE SEGURIDAD DE ESTA WEB
          </div>
          <h3 className="lab-card-title">Auditoría en directo del navegador</h3>
          <div className="lab-howto">
            <strong>Qué comprueba realmente:</strong> Lee las reglas activas de
            esta página (bloqueo de scripts externos, privacidad de enlaces y
            criptografía) y prueba en vivo que al exportar a Excel no se cuelen
            fórmulas maliciosas.
          </div>
          <div className="inline-controls" style={{ alignItems: 'center' }}>
            <button className="btn-primary" onClick={handleRunBrowserAudit}>
              Ejecutar auditoría real + F12
            </button>
            <span
              className="mono"
              style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}
            >
              Bloqueos CSP: {cspViolations}
            </span>
          </div>
          {auditChecks && (
            <table className="sample-table mono">
              <thead>
                <tr>
                  <th>Comprobación real</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {auditChecks.map((row) => (
                  <tr key={row.control} title={row.evidencia}>
                    <td>
                      <div>{row.control}</div>
                      <div
                        style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}
                      >
                        {row.evidencia}
                      </div>
                    </td>
                    <td style={{ color: 'var(--success)', fontWeight: 700 }}>
                      {row.estado}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </article>
      </div>
    </section>
  );
}