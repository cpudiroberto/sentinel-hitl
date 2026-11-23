import { useEffect, useMemo, useRef, useState } from 'react';
import {
  computeDashboardMetrics,
  createRateLimiter,
  evaluateRiskEvent,
  runQueryBenchmark,
  sanitizeNote,
} from './engine/securityEngine';

const INITIAL_SCENARIOS = [
  {
    id: 'EVT-9041',
    type: 'FINANCIAL',
    title: 'Transferencia internacional de alto importe',
    account: 'ES91 •••• 4821 (Tesorería Corp.)',
    amount: 4850,
    foreignCountry: true,
    location: 'Singapur (SG)',
    unusualHour: true,
    timestamp: '02:14 UTC',
  },
  {
    id: 'EVT-9042',
    type: 'ACCESS',
    title: 'Acceso administrativo con viaje imposible',
    account: 'admin.finanzas@empresa.es',
    impossibleTravel: true,
    location: 'Madrid → Tokio (11 min)',
    unknownDevice: true,
    failedAttempts: 4,
    timestamp: '02:16 UTC',
  },
  {
    id: 'EVT-9043',
    type: 'FINANCIAL',
    title: 'Pago fraccionado a proveedor no verificado',
    account: 'ES44 •••• 1093 (Cuenta Operativa)',
    amount: 1650,
    foreignCountry: true,
    location: 'Bucarest (RO)',
    unusualHour: false,
    timestamp: '02:19 UTC',
  },
];

const EXTRA_SCENARIOS = [
  {
    type: 'ACCESS',
    title: 'Intento de escalado de privilegios en API',
    account: 'svc-pagos-prod@empresa.es',
    impossibleTravel: false,
    location: 'Frankfurt (DE)',
    unknownDevice: true,
    failedAttempts: 5,
  },
  {
    type: 'FINANCIAL',
    title: 'Retirada urgente fuera de horario bancario',
    account: 'ES12 •••• 7730 (Fondo Liquidez)',
    amount: 6200,
    foreignCountry: true,
    location: 'Dubái (AE)',
    unusualHour: true,
  },
];

function buildEvaluatedEvent(raw) {
  const risk = evaluateRiskEvent(raw);
  return { ...raw, risk, status: 'PENDING', note: '' };
}

export default function App() {
  const [entered, setEntered] = useState(false);
  const [activeTab, setActiveTab] = useState('console');
  const [events, setEvents] = useState(() =>
    INITIAL_SCENARIOS.slice(0, 2).map(buildEvaluatedEvent)
  );
  const [toasts, setToasts] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [noteInput, setNoteInput] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(false);

  // Laboratorio: Rate Limiting (HTTP 429)
  const limiterRef = useRef(
    createRateLimiter({ maxAttempts: 5, windowMs: 60000 })
  );
  const [loginStatus, setLoginStatus] = useState({
    status: 200,
    attempts: 0,
    maxAttempts: 5,
    retryAfterSec: 0,
    message: 'Listo para recibir peticiones en /api/login',
  });

  // Laboratorio: Benchmark N+1 vs SQL Agregado
  const [clientCount, setClientCount] = useState(40);
  const benchmark = useMemo(
    () => runQueryBenchmark(clientCount),
    [clientCount]
  );

  const metrics = useMemo(() => computeDashboardMetrics(events), [events]);
  const selectedEvent = useMemo(
    () => events.find((e) => e.id === selectedEventId) || null,
    [events, selectedEventId]
  );

  const extraCounterRef = useRef(0);

  const pushToast = (evt) => {
    setToasts((prev) => {
      if (prev.some((t) => t.id === evt.id)) return prev;
      return [evt, ...prev].slice(0, 3);
    });

    if (
      notifEnabled &&
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted' &&
      document.hidden
    ) {
      new Notification(`Sentinel HITL · Riesgo ${evt.risk.level}`, {
        body: `${evt.title} (${evt.risk.score}% confianza)`,
      });
    }
  };

  // Dispara primera alerta viva a los 1.5s de entrar desde la antesala
  useEffect(() => {
    if (!entered) return undefined;
    const timer = setTimeout(() => {
      const incoming = buildEvaluatedEvent(INITIAL_SCENARIOS[2]);
      setEvents((prev) =>
        prev.some((e) => e.id === incoming.id) ? prev : [incoming, ...prev]
      );
      pushToast(incoming);
    }, 1500);
    return () => clearTimeout(timer);
  }, [entered]);

  // Cuenta atrás en vivo para HTTP 429
  useEffect(() => {
    if (loginStatus.retryAfterSec <= 0) return undefined;
    const interval = setInterval(() => {
      setLoginStatus((prev) => {
        if (prev.retryAfterSec <= 1) {
          return {
            ...prev,
            status: 200,
            retryAfterSec: 0,
            message: 'Ventana liberada. Puedes volver a probar /api/login.',
          };
        }
        return { ...prev, retryAfterSec: prev.retryAfterSec - 1 };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [loginStatus.retryAfterSec]);

  // Cierre de modal con tecla Escape
  useEffect(() => {
    if (!selectedEventId) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSelectedEventId(null);
        setNoteInput('');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedEventId]);

  const handleToggleNotifications = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return;
    }
    if (notifEnabled) {
      setNotifEnabled(false);
      return;
    }
    if (Notification.permission === 'granted') {
      setNotifEnabled(true);
      return;
    }
    const perm = await Notification.requestPermission();
    setNotifEnabled(perm === 'granted');
  };

  const handleSimulateNewAlert = () => {
    const template =
      EXTRA_SCENARIOS[extraCounterRef.current % EXTRA_SCENARIOS.length];
    extraCounterRef.current += 1;
    const now = new Date();
    const evt = buildEvaluatedEvent({
      ...template,
      id: `EVT-${9050 + extraCounterRef.current}`,
      timestamp: now.toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    });
    setEvents((prev) => [evt, ...prev]);
    pushToast(evt);
  };

  const handleOpenModal = (evt) => {
    setSelectedEventId(evt.id);
    setNoteInput(evt.note || '');
  };

  const handleResolveEvent = (newStatus) => {
    if (!selectedEvent || isResolving) return;
    setIsResolving(true);
    const cleanNote = sanitizeNote(noteInput, 160);

    setEvents((prev) =>
      prev.map((e) =>
        e.id === selectedEvent.id
          ? { ...e, status: newStatus, note: cleanNote }
          : e
      )
    );
    setToasts((prev) => prev.filter((t) => t.id !== selectedEvent.id));
    setSelectedEventId(null);
    setNoteInput('');
    setTimeout(() => setIsResolving(false), 180);
  };

  const handleSimulateLogin = () => {
    const res = limiterRef.current.attempt();
    setLoginStatus({
      ...res,
      message: res.allowed
        ? `Acceso procesado (${res.attempts}/${res.maxAttempts} intentos en 60s)`
        : 'Bloqueo preventivo activado por fuerza bruta (HTTP 429)',
    });
  };

  const handleResetLimiter = () => {
    limiterRef.current.reset();
    setLoginStatus({
      status: 200,
      attempts: 0,
      maxAttempts: 5,
      retryAfterSec: 0,
      message: 'Contador reiniciado. Listo para nuevas pruebas.',
    });
  };

  const handleResetDemo = () => {
    setEvents(INITIAL_SCENARIOS.slice(0, 2).map(buildEvaluatedEvent));
    setToasts([]);
    setSelectedEventId(null);
    setNoteInput('');
    handleResetLimiter();
  };

  if (!entered) {
    return (
      <main className="welcome-wrap">
        <section className="welcome-card">
          <span className="pill">
            Portfolio Interactivo · Roberto Di Giovanni
          </span>
          <h1 className="welcome-title">
            Sentinel HITL: Seguridad de Accesos y Antifraude
          </h1>
          <p className="welcome-sub">
            Prueba en 45 segundos cómo diseño interfaces reactivas con control
            humano sobre IA, protección contra fuerza bruta y optimización de
            rendimiento. Sin registros y en tiempo real.
          </p>

          <div className="feature-grid">
            <article className="feature-box">
              <h3>1. Supervisión IA (HITL)</h3>
              <p>
                Recibe alertas de fraude y accesos anómalos; aprueba o bloquea
                cada operación desde un modal auditado.
              </p>
            </article>
            <article className="feature-box">
              <h3>2. Escudo HTTP 429</h3>
              <p>
                Simula un ataque de fuerza bruta en vivo y comprueba el bloqueo
                automático tras 5 intentos por minuto.
              </p>
            </article>
            <article className="feature-box">
              <h3>3. Rendimiento SQL</h3>
              <p>
                Compara visualmente consultas N+1 frente a agregación SQL
                reduciendo la latencia en más de un 70%.
              </p>
            </article>
          </div>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.75rem',
              alignItems: 'center',
            }}
          >
            <button
              className="btn-primary"
              onClick={() => setEntered(true)}
              style={{ padding: '0.8rem 1.45rem', fontSize: '0.98rem' }}
            >
              Probar la consola interactiva →
            </button>
            <span
              className="mono"
              style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}
            >
              Modo Simulación · Datos Sintéticos · 0€ Serverless
            </span>
          </div>
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div>
            <h1>Sentinel HITL</h1>
            <span
              className="mono"
              style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}
            >
              Modo Simulación · Datos Sintéticos
            </span>
          </div>
        </div>
        <div className="topbar-actions">
          {'Notification' in window && (
            <button
              className="btn-secondary"
              onClick={handleToggleNotifications}
            >
              {notifEnabled ? 'Alertas escritorio: ON' : 'Alertas escritorio'}
            </button>
          )}
          <button className="btn-secondary" onClick={handleResetDemo}>
            Reiniciar demo
          </button>
          <button className="btn-secondary" onClick={() => setEntered(false)}>
            Portada
          </button>
        </div>
      </header>

      <section className="kpi-grid" aria-label="Métricas centralizadas">
        <div className="card">
          <div className="kpi-label">Pendientes (HITL)</div>
          <div className="kpi-value mono">{metrics.pending}</div>
        </div>
        <div className="card">
          <div className="kpi-label">Amenazas bloqueadas</div>
          <div className="kpi-value mono">{metrics.blocked}</div>
        </div>
        <div className="card">
          <div className="kpi-label">Capital protegido</div>
          <div className="kpi-value mono" style={{ color: 'var(--success)' }}>
            {metrics.protectedCapital.toLocaleString('es-ES')} €
          </div>
        </div>
        <div className="card">
          <div className="kpi-label">Nivel de amenaza</div>
          <div style={{ marginTop: '0.45rem' }}>
            <span
              className={`badge ${
                metrics.threatLevel === 'ELEVADO'
                  ? 'badge-critical'
                  : metrics.threatLevel === 'VIGILANCIA'
                    ? 'badge-high'
                    : 'badge-ok'
              }`}
            >
              {metrics.threatLevel}
            </span>
          </div>
        </div>
      </section>

      <nav className="tabs" aria-label="Secciones de la consola">
        <button
          className={`tab-btn ${activeTab === 'console' ? 'active' : ''}`}
          onClick={() => setActiveTab('console')}
        >
          Consola HITL ({metrics.pending})
        </button>
        <button
          className={`tab-btn ${activeTab === 'lab' ? 'active' : ''}`}
          onClick={() => setActiveTab('lab')}
        >
          Laboratorio 429 &amp; N+1
        </button>
        <button
          className={`tab-btn ${activeTab === 'quality' ? 'active' : ''}`}
          onClick={() => setActiveTab('quality')}
        >
          Arquitectura y Calidad
        </button>
      </nav>

      {activeTab === 'console' && (
        <section>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '0.75rem',
              marginBottom: '0.9rem',
            }}
          >
            <h2 style={{ margin: 0, fontSize: '1.05rem' }}>
              Cola de eventos evaluados por el motor de riesgo
            </h2>
            <button className="btn-primary" onClick={handleSimulateNewAlert}>
              + Simular nueva alerta
            </button>
          </div>

          {events.length === 0 ? (
            <div className="card" style={{ textAlign: 'center' }}>
              <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                No hay alertas activas en cola. Pulsa «Simular nueva alerta»
                para probar el flujo HITL.
              </p>
            </div>
          ) : (
            <div className="event-list">
              {events.map((evt) => (
                <article key={evt.id} className="event-item">
                  <div style={{ flex: '1 1 280px' }}>
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '0.45rem',
                        alignItems: 'center',
                        marginBottom: '0.35rem',
                      }}
                    >
                      <span className="mono" style={{ fontSize: '0.78rem' }}>
                        {evt.id}
                      </span>
                      <span
                        className={`badge ${
                          evt.risk.level === 'CRÍTICO'
                            ? 'badge-critical'
                            : 'badge-high'
                        }`}
                      >
                        {evt.risk.level} · {evt.risk.score}%
                      </span>
                      <span className="badge badge-neutral">
                        {evt.type === 'FINANCIAL' ? 'Antifraude' : 'Acceso IAM'}
                      </span>
                      {evt.status !== 'PENDING' && (
                        <span
                          className={`badge ${
                            evt.status === 'BLOCKED'
                              ? 'badge-critical'
                              : 'badge-ok'
                          }`}
                        >
                          {evt.status === 'BLOCKED' ? 'BLOQUEADA' : 'APROBADA'}
                        </span>
                      )}
                    </div>
                    <strong style={{ display: 'block', fontSize: '0.96rem' }}>
                      {evt.title}
                    </strong>
                    <div
                      style={{
                        fontSize: '0.84rem',
                        color: 'var(--text-muted)',
                        marginTop: '0.2rem',
                      }}
                    >
                      {evt.account} · {evt.location} ·{' '}
                      <span className="mono">{evt.timestamp}</span>
                    </div>
                    {evt.note && (
                      <div
                        style={{
                          fontSize: '0.82rem',
                          marginTop: '0.35rem',
                          color: 'var(--text)',
                        }}
                      >
                        Nota operador: <em>{evt.note}</em>
                      </div>
                    )}
                  </div>

                  <div>
                    <button
                      className={
                        evt.status === 'PENDING'
                          ? 'btn-primary'
                          : 'btn-secondary'
                      }
                      onClick={() => handleOpenModal(evt)}
                    >
                      {evt.status === 'PENDING'
                        ? 'Revisar (HITL)'
                        : 'Ver / Editar'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === 'lab' && (
        <section className="lab-grid">
          <article className="card">
            <span className="badge badge-critical">Seguridad Backend</span>
            <h2 style={{ margin: '0.6rem 0 0.35rem', fontSize: '1.05rem' }}>
              Simulador Rate Limiting (/api/login)
            </h2>
            <p
              style={{
                margin: '0 0 1rem',
                fontSize: '0.86rem',
                color: 'var(--text-muted)',
              }}
            >
              Pulsa repetidamente para simular fuerza bruta. Al superar 5
              intentos en 60 segundos, el motor bloquea con{' '}
              <span className="mono">HTTP 429</span>.
            </p>

            <div
              style={{
                padding: '0.85rem',
                borderRadius: 10,
                background:
                  loginStatus.status === 429
                    ? 'var(--danger-bg)'
                    : 'var(--bg)',
                border: '1px solid var(--border)',
                marginBottom: '1rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <strong className="mono">HTTP {loginStatus.status}</strong>
                <span className="mono" style={{ fontSize: '0.82rem' }}>
                  {loginStatus.attempts}/{loginStatus.maxAttempts} req/min
                </span>
              </div>
              <p style={{ margin: '0.4rem 0 0', fontSize: '0.84rem' }}>
                {loginStatus.message}
              </p>
              {loginStatus.retryAfterSec > 0 && (
                <div
                  className="mono"
                  style={{
                    marginTop: '0.45rem',
                    fontSize: '0.84rem',
                    color: 'var(--danger)',
                    fontWeight: 700,
                  }}
                >
                  Reintento disponible en: {loginStatus.retryAfterSec}s
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                className="btn-danger"
                onClick={handleSimulateLogin}
                disabled={loginStatus.status === 429}
              >
                Simular intento de login
              </button>
              <button className="btn-secondary" onClick={handleResetLimiter}>
                Reiniciar ventana
              </button>
            </div>
          </article>

          <article className="card">
            <span className="badge badge-ok">
              Rendimiento SQL (-{benchmark.reductionPct}%)
            </span>
            <h2 style={{ margin: '0.6rem 0 0.35rem', fontSize: '1.05rem' }}>
              Eliminación de consultas N+1
            </h2>
            <p
              style={{
                margin: '0 0 0.85rem',
                fontSize: '0.86rem',
                color: 'var(--text-muted)',
              }}
            >
              Compara cargar historiales con llamadas individuales por tarjeta
              frente a una única consulta SQL agrupada.
            </p>

            <div
              style={{
                display: 'flex',
                gap: '0.45rem',
                marginBottom: '1rem',
                flexWrap: 'wrap',
              }}
            >
              {[20, 40, 80].map((n) => (
                <button
                  key={n}
                  className={
                    clientCount === n ? 'btn-primary' : 'btn-secondary'
                  }
                  onClick={() => setClientCount(n)}
                >
                  {n} clientes
                </button>
              ))}
            </div>

            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.84rem',
                }}
              >
                <span>Patrón N+1 ({benchmark.nPlusOne.queries} consultas)</span>
                <strong className="mono">
                  {benchmark.nPlusOne.latencyMs} ms
                </strong>
              </div>
              <div className="bar-track">
                <div
                  className="bar-fill"
                  style={{ width: '100%', background: 'var(--danger)' }}
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.84rem',
                }}
              >
                <span>
                  SQL Agregado ({benchmark.aggregated.queries} consulta)
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
                      12,
                      Math.round(
                        (benchmark.aggregated.latencyMs /
                          benchmark.nPlusOne.latencyMs) *
                          100
                      )
                    )}%`,
                    background: 'var(--success)',
                  }}
                />
              </div>
            </div>
          </article>
        </section>
      )}

      {activeTab === 'quality' && (
        <section className="lab-grid">
          <article className="card">
            <span className="badge badge-ok">Calidad verificada</span>
            <h2 style={{ margin: '0.6rem 0 0.5rem', fontSize: '1.05rem' }}>
              Ingeniería aplicada en este proyecto
            </h2>
            <ul
              style={{
                margin: 0,
                paddingLeft: '1.15rem',
                fontSize: '0.88rem',
                color: 'var(--text-muted)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.45rem',
              }}
            >
              <li>
                <strong style={{ color: 'var(--text)' }}>
                  Motor puro testeado:
                </strong>{' '}
                Reglas antifraude, Rate Limiter HTTP 429 y saneado de texto
                cubiertos con pruebas unitarias en Vitest.
              </li>
              <li>
                <strong style={{ color: 'var(--text)' }}>
                  Resiliencia UI:
                </strong>{' '}
                ErrorBoundary global, bloqueo anti-doble clic, límite de toasts
                y cierre accesible con tecla Escape.
              </li>
              <li>
                <strong style={{ color: 'var(--text)' }}>
                  Fuente Única de Verdad:
                </strong>{' '}
                Contadores y nivel de amenaza derivados de un único estado
                inmutable sin discrepancias.
              </li>
              <li>
                <strong style={{ color: 'var(--text)' }}>
                  Flujo profesional:
                </strong>{' '}
                GitHub Flow (ramas feat + PR), ESLint/Prettier, Dockerfile con
                Nginx y despliegue automatizado en GitHub Pages.
              </li>
            </ul>
          </article>

          <article className="card">
            <span className="pill">Autor</span>
            <h2 style={{ margin: '0.6rem 0 0.35rem', fontSize: '1.05rem' }}>
              Roberto Di Giovanni Igartua
            </h2>
            <p
              style={{
                margin: '0 0 1rem',
                fontSize: '0.88rem',
                color: 'var(--text-muted)',
              }}
            >
              Desarrollador Full Stack (React · FastAPI · SQL) enfocado en
              seguridad, sistemas con IA supervisada (HITL) y calidad de
              software.
            </p>
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
              <a
                href="https://github.com/cpudiroberto"
                target="_blank"
                rel="noreferrer"
                className="btn-primary"
                style={{ textDecoration: 'none' }}
              >
                Ver perfil en GitHub ↗
              </a>
            </div>
          </article>
        </section>
      )}

      {/* Toasts flotantes (máximo 3) */}
      {toasts.length > 0 && (
        <aside className="toast-stack" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className="toast-card">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.3rem',
                }}
              >
                <span className="badge badge-critical">
                  Alerta HITL · {t.risk.score}%
                </span>
                <button
                  className="btn-secondary"
                  style={{ padding: '0.15rem 0.45rem', fontSize: '0.78rem' }}
                  onClick={() =>
                    setToasts((prev) => prev.filter((item) => item.id !== t.id))
                  }
                  aria-label="Cerrar aviso"
                >
                  ×
                </button>
              </div>
              <strong style={{ display: 'block', fontSize: '0.86rem' }}>
                {t.title}
              </strong>
              <div
                style={{
                  fontSize: '0.78rem',
                  color: 'var(--text-muted)',
                  margin: '0.2rem 0 0.6rem',
                }}
              >
                {t.location}
              </div>
              <button
                className="btn-primary"
                style={{ width: '100%', padding: '0.45rem' }}
                onClick={() => handleOpenModal(t)}
              >
                Revisar decisión
              </button>
            </div>
          ))}
        </aside>
      )}

      {/* Modal de decisión HITL */}
      {selectedEvent && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => {
            setSelectedEventId(null);
            setNoteInput('');
          }}
        >
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.65rem',
              }}
            >
              <span className="badge badge-critical">
                Intervención Humana · {selectedEvent.risk.score}% Riesgo
              </span>
              <span className="mono" style={{ fontSize: '0.8rem' }}>
                {selectedEvent.id}
              </span>
            </div>

            <h3 style={{ margin: '0 0 0.35rem', fontSize: '1.1rem' }}>
              {selectedEvent.title}
            </h3>
            <p
              style={{
                margin: '0 0 0.85rem',
                fontSize: '0.86rem',
                color: 'var(--text-muted)',
              }}
            >
              {selectedEvent.account} · {selectedEvent.location}
            </p>

            <div
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: '0.75rem',
                marginBottom: '0.9rem',
                fontSize: '0.84rem',
              }}
            >
              <strong>Factores detectados:</strong>
              <ul style={{ margin: '0.35rem 0 0', paddingLeft: '1.1rem' }}>
                {selectedEvent.risk.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>

            <label
              htmlFor="hitl-note"
              style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600 }}
            >
              Justificación de auditoría (opcional, máx. 160 caracteres)
            </label>
            <textarea
              id="hitl-note"
              className="modal-textarea"
              maxLength={160}
              placeholder="Ej.: Cliente contactado por teléfono; se confirma bloqueo preventivo."
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
            />
            <div
              className="mono"
              style={{
                textAlign: 'right',
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                marginBottom: '1rem',
              }}
            >
              {noteInput.length}/160
            </div>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.55rem',
                justifyContent: 'flex-end',
              }}
            >
              <button
                className="btn-secondary"
                onClick={() => {
                  setSelectedEventId(null);
                  setNoteInput('');
                }}
              >
                Cancelar
              </button>
              <button
                className="btn-success"
                disabled={isResolving}
                onClick={() => handleResolveEvent('APPROVED')}
              >
                Aprobar operación
              </button>
              <button
                className="btn-danger"
                disabled={isResolving}
                onClick={() => handleResolveEvent('BLOCKED')}
              >
                Bloquear cuenta/op.
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}