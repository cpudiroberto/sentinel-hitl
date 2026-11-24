import { useEffect, useRef, useState } from 'react';
import {
  computeSha256Hex,
  createIdempotencyGuard,
  createRateLimiter,
  escapeCsvCell,
  runQueryBenchmark,
  sanitizeNote,
} from '../engine/securityEngine';
import { playTone } from '../utils/audioEngine';

const INITIAL_CRYPTO_PAYLOAD = 'EVT-9041 | ES91-4821 | 3400 EUR | BLOCKED';

export default function DefenseLab({ isSpotlight }) {
  // 1. Escudo HTTP 429
  const limiterRef = useRef(
    createRateLimiter({ maxAttempts: 5, windowMs: 60000 })
  );
  const [attackerIp, setAttackerIp] = useState('185.199.110.42');
  const [loginStatus, setLoginStatus] = useState({
    status: 200,
    attempts: 0,
    maxAttempts: 5,
    retryAfterSec: 0,
    message: 'Puerta de acceso abierta (/api/auth/login).',
  });
  const [httpLogs, setHttpLogs] = useState([
    'Esperando intentos de autenticación en /api/auth/login...',
  ]);

  // 2. Benchmark Real N+1 en RAM (estado directo -> cero warnings de useMemo)
  const [benchSize, setBenchSize] = useState(15000);
  const [clientCount, setClientCount] = useState(40);
  const [benchmark, setBenchmark] = useState(() =>
    runQueryBenchmark(40, 15000)
  );

  // 3. Anti-XSS
  const [xssInput, setXssInput] = useState(
    '<script>alert("Robo de sesión")</script> Transferencia verificada'
  );

  // 4. Web Crypto API (SHA-256)
  const [cryptoPayload, setCryptoPayload] = useState(INITIAL_CRYPTO_PAYLOAD);
  const [sealedHash, setSealedHash] = useState('');
  const [currentHash, setCurrentHash] = useState('');

  // 5. Anti-CSRF + Idempotencia
  const idempGuardRef = useRef(createIdempotencyGuard());
  const [activeIdempKey, setActiveIdempKey] = useState(() =>
    idempGuardRef.current.generateKey()
  );
  const [idempLog, setIdempLog] = useState([
    'Envía una orden (201), repítela para provocar bloqueo (409) o falsifica el CSRF (403).',
  ]);

  // 6. Auditoría Hardening Real (CSP + DOM + CSV)
  const [auditChecks, setAuditChecks] = useState(null);
  const [cspViolations, setCspViolations] = useState(0);

  // Cuenta atrás del bloqueo HTTP 429
  useEffect(() => {
    if (loginStatus.retryAfterSec <= 0) return undefined;
    const interval = setInterval(() => {
      setLoginStatus((prev) => {
        if (prev.retryAfterSec <= 1) {
          return {
            ...prev,
            status: 200,
            retryAfterSec: 0,
            message: 'Bloqueo finalizado. Puerta de acceso operativa.',
          };
        }
        return { ...prev, retryAfterSec: prev.retryAfterSec - 1 };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [loginStatus.retryAfterSec]);

  // Sello inicial SHA-256 al montar
  useEffect(() => {
    let active = true;
    computeSha256Hex(INITIAL_CRYPTO_PAYLOAD).then((hex) => {
      if (active) setSealedHash(hex);
    });
    return () => {
      active = false;
    };
  }, []);

  // Recálculo SHA-256 al modificar payload
  useEffect(() => {
    let active = true;
    computeSha256Hex(cryptoPayload).then((hex) => {
      if (active) setCurrentHash(hex);
    });
    return () => {
      active = false;
    };
  }, [cryptoPayload]);

  // Listener real de violaciones CSP
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
    for (let i = 0; i < times; i++) {
      lastRes = limiterRef.current.attempt();
      newLogs.unshift(
        `[${time}] ${attackerIp} → POST /api/auth/login → HTTP ${lastRes.status} ${lastRes.allowed ? 'OK' : 'TOO MANY REQUESTS'}`
      );
    }
    setLoginStatus({
      ...lastRes,
      message: lastRes.allowed
        ? `Acceso permitido (${lastRes.attempts}/${lastRes.maxAttempts} intentos en 60s)`
        : `BLOQUEO ACTIVO para ${attackerIp}: HTTP 429 Too Many Requests`,
    });
    setHttpLogs((prev) => [...newLogs, ...prev].slice(0, 5));
    console.info('[Sentinel HTTP 429]', {
      sourceIp: attackerIp,
      burst,
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
      message: 'Ventana reiniciada. Puerta de acceso operativa.',
    });
    setHttpLogs(['Contador reiniciado. Listo para nuevas peticiones.']);
  };

  const handleRunBenchmark = (newClients = clientCount, newSize = benchSize) => {
    playTone('verify');
    setClientCount(newClients);
    setBenchSize(newSize);
    const snap = runQueryBenchmark(newClients, newSize);
    setBenchmark(snap);
    console.groupCollapsed(
      `[Sentinel Benchmark] ${newSize.toLocaleString('es-ES')} ops · ${newClients} clientes`
    );
    console.table({
      'Patrón N+1 (Lento)': {
        consultas: snap.nPlusOne.queries,
        iteraciones: snap.nPlusOne.iterations,
        latenciaMs: snap.nPlusOne.latencyMs,
      },
      'Agregación Map (Optimizado)': {
        consultas: snap.aggregated.queries,
        iteraciones: snap.aggregated.iterations,
        latenciaMs: snap.aggregated.latencyMs,
      },
    });
    console.groupEnd();
  };

  const handleSealCrypto = async () => {
    playTone('verify');
    const hex = await computeSha256Hex(cryptoPayload);
    setSealedHash(hex);
    setCurrentHash(hex);
    console.info('[Sentinel WebCrypto SHA-256]', {
      payload: cryptoPayload,
      sha256: hex,
    });
  };

  const handleIdempotencyTest = (forgedCsrf = false) => {
    const res = idempGuardRef.current.execute({
      idempotencyKey: activeIdempKey,
      providedCsrf: forgedCsrf
        ? 'csrf_atacante_invalido'
        : idempGuardRef.current.getCsrfToken(),
      amount: 1250,
    });
    const time = new Date().toLocaleTimeString('es-ES');
    setIdempLog((prev) =>
      [`[${time}] HTTP ${res.status} · ${res.reason}`, ...prev].slice(0, 4)
    );
    console.info('[Sentinel Idempotency + CSRF]', {
      idempotencyKey: activeIdempKey,
      csrfTokenSent: forgedCsrf
        ? 'csrf_atacante_invalido'
        : idempGuardRef.current.getCsrfToken(),
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
        control: 'Content-Security-Policy (DOM)',
        estado: cspMeta ? 'VERIFICADA' : 'AUSENTE',
        evidencia: cspMeta
          ? `${cspMeta.content.slice(0, 42)}...`
          : 'Sin etiqueta CSP',
      },
      {
        control: 'Referrer-Policy (DOM)',
        estado: refMeta ? 'VERIFICADA' : 'AUSENTE',
        evidencia: refMeta?.content || 'Por defecto',
      },
      {
        control: 'Anti-Tabnabbing (DOM links)',
        estado: unsafeLinks === 0 ? 'SEGURO (0)' : `ALERTA (${unsafeLinks})`,
        evidencia: `${unsafeLinks} enlaces sin noopener`,
      },
      {
        control: 'Web Crypto API (SHA-256)',
        estado: typeof crypto?.subtle !== 'undefined' ? 'ACTIVA' : 'FALLBACK',
        evidencia: window.isSecureContext ? 'SecureContext OK' : 'Local',
      },
      {
        control: 'Test Vivo CSV Injection',
        estado: csvSafe ? 'BLOQUEADO' : 'FALLO',
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
          MÓDULO 02 · LABORATORIO INTERACTIVO DE INGENIERÍA
        </span>
        <h2>Defensa Activa y Rendimiento (6 Pruebas Reales en F12)</h2>
        <p>
          Cada tarjeta ejecuta código real en tu navegador. Abre{' '}
          <span className="mono">F12 → Console</span> mientras pruebas para
          verificar tiempos, hashes y bloqueos en directo.
        </p>
      </div>

      <div
        id="tour-lab-grid"
        className={`lab-grid ${isSpotlight ? 'tour-spotlight' : ''}`}
      >
        {/* 1. HTTP 429 */}
        <article className="card interactive-card">
          <span className="badge badge-critical">
            1. Escudo de Acceso (HTTP 429)
          </span>
          <h3 className="lab-card-title">Bloqueo contra fuerza bruta</h3>
          <div className="lab-howto">
            <strong>Cómo comprobarlo:</strong> Elige una IP y lanza una ráfaga o
            pulsa 6 veces. Al superar 5 intentos/minuto se activa{' '}
            <strong>HTTP 429</strong> con cuenta atrás y traza en F12.
          </div>

          <div className="inline-controls">
            {['185.199.110.42', '91.214.124.8'].map((ip) => (
              <button
                key={ip}
                className={attackerIp === ip ? 'btn-primary' : 'btn-secondary'}
                style={{ padding: '0.32rem 0.65rem', fontSize: '0.78rem' }}
                onClick={() => {
                  playTone('click');
                  setAttackerIp(ip);
                }}
              >
                IP: {ip}
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
              BLOQUEADO · Reintento en {loginStatus.retryAfterSec}s
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
          <span className="badge badge-ok">
            2. Rendimiento Real (-{benchmark.reductionPct}% tiempo)
          </span>
          <h3 className="lab-card-title">
            Agregación real ({benchSize.toLocaleString('es-ES')} ops)
          </h3>
          <div className="lab-howto">
            <strong>Cómo comprobarlo:</strong> Ajusta volumen y clientes. Genera
            transacciones reales en RAM (total:{' '}
            <strong className="mono">
              {benchmark.totalVolumeEur.toLocaleString('es-ES')} €
            </strong>
            ) y vuelca la tabla comparativa a F12.
          </div>

          <div className="inline-controls">
            {[5000, 15000, 30000].map((sz) => (
              <button
                key={sz}
                className={benchSize === sz ? 'btn-primary' : 'btn-secondary'}
                style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem' }}
                onClick={() => handleRunBenchmark(clientCount, sz)}
              >
                {(sz / 1000).toFixed(0)}k ops
              </button>
            ))}
            {[20, 40, 80].map((n) => (
              <button
                key={n}
                className={clientCount === n ? 'btn-primary' : 'btn-secondary'}
                style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem' }}
                onClick={() => handleRunBenchmark(n, benchSize)}
              >
                {n} cli
              </button>
            ))}
          </div>

          <div>
            <div className="bench-row">
              <span>
                N+1 ({benchmark.nPlusOne.iterations.toLocaleString('es-ES')}{' '}
                iter.)
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
                Map ({benchmark.aggregated.iterations.toLocaleString('es-ES')}{' '}
                iter.)
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
                <th>Muestra ID</th>
                <th>Cliente</th>
                <th>Importe</th>
              </tr>
            </thead>
            <tbody>
              {benchmark.sampleRows.map((r) => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>CLI-{r.clientId}</td>
                  <td>{r.amount} €</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>

        {/* 3. Anti-XSS */}
        <article className="card interactive-card">
          <span className="badge badge-ai">3. Sanitización Anti-XSS</span>
          <h3 className="lab-card-title">Neutralización de scripts</h3>
          <div className="lab-howto">
            <strong>Cómo comprobarlo:</strong> Carga un vector de ataque o
            escribe HTML malicioso; verás cuántas etiquetas se neutralizan antes
            de guardar cualquier nota.
          </div>
          <div className="inline-controls">
            <button
              className="btn-secondary"
              style={{ padding: '0.3rem 0.6rem', fontSize: '0.76rem' }}
              onClick={() => {
                playTone('click');
                setXssInput('<script>fetch("https://evil.test")</script> Pago OK');
              }}
            >
              Vector &lt;script&gt;
            </button>
            <button
              className="btn-secondary"
              style={{ padding: '0.3rem 0.6rem', fontSize: '0.76rem' }}
              onClick={() => {
                playTone('click');
                setXssInput('<img src=x onerror="stealCookie()"> Revisado');
              }}
            >
              Vector &lt;img onerror&gt;
            </button>
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
              SALIDA SEGURA ({xssStrippedCount} etiquetas neutralizadas):
            </div>
            <div className="mono" style={{ fontSize: '0.84rem' }}>
              {sanitizeNote(xssInput, 160) || '(vacío)'}
            </div>
          </div>
        </article>

        {/* 4. Criptografía SHA-256 */}
        <article className="card interactive-card">
          <span className="badge badge-ai">4. Web Crypto API (SHA-256)</span>
          <h3 className="lab-card-title">Sello criptográfico en vivo</h3>
          <div className="lab-howto">
            <strong>Cómo comprobarlo:</strong> Pulsa «Sellar» y luego «Alterar
            +1 €» para comprobar el efecto avalancha del hash SHA-256 de 64
            caracteres.
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
              className={`badge ${cryptoIntact ? 'badge-ok' : 'badge-critical'}`}
            >
              {cryptoIntact ? 'INTEGRIDAD VERIFICADA' : 'ALTERACIÓN DETECTADA'}
            </span>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button
                className="btn-secondary"
                style={{ padding: '0.4rem 0.7rem', fontSize: '0.78rem' }}
                onClick={() => {
                  playTone('error429');
                  setCryptoPayload((p) =>
                    p.includes('3400') ? p.replace('3400', '3401') : `${p} [EDIT]`
                  );
                }}
              >
                Alterar +1 €
              </button>
              <button
                className="btn-primary"
                style={{ padding: '0.4rem 0.75rem', fontSize: '0.78rem' }}
                onClick={handleSealCrypto}
              >
                Sellar + F12
              </button>
            </div>
          </div>
        </article>

        {/* 5. Anti-CSRF + Idempotencia */}
        <article className="card interactive-card">
          <span className="badge badge-high">
            5. Anti-CSRF + Idempotencia (409)
          </span>
          <h3 className="lab-card-title">Prevención de doble cobro</h3>
          <div className="lab-howto">
            <strong>Cómo comprobarlo:</strong> Pulsa «Enviar orden» dos veces
            con la misma clave para disparar <strong>HTTP 409</strong>, o envía
            un CSRF forjado (<strong>403</strong>).
          </div>
          <div
            className="mono"
            style={{
              fontSize: '0.74rem',
              color: 'var(--text-muted)',
              marginBottom: '0.5rem',
            }}
          >
            Key: <strong>{activeIdempKey}</strong> · CSRF:{' '}
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
              Enviar orden (1.250 €)
            </button>
            <button
              className="btn-danger"
              onClick={() => handleIdempotencyTest(true)}
            >
              CSRF forjado
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

        {/* 6. Auditoría Hardening REAL */}
        <article className="card interactive-card">
          <span className="badge badge-ok">
            6. Auditoría Hardening Real (CSP + DOM)
          </span>
          <h3 className="lab-card-title">Diagnóstico real en vivo</h3>
          <div className="lab-howto">
            <strong>Cómo comprobarlo:</strong> Inspecciona las etiquetas de
            seguridad reales del DOM, ejecuta un payload real de CSV Injection y
            vuelca la evidencia en <span className="mono">F12</span>.
          </div>
          <div className="inline-controls" style={{ alignItems: 'center' }}>
            <button className="btn-primary" onClick={handleRunBrowserAudit}>
              Ejecutar diagnóstico + F12
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
                  <th>Prueba real</th>
                  <th>Resultado</th>
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