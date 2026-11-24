import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  SPANISH_LEGAL_COMPENDIUM,
  evaluateRiskEvent,
  sanitizeNote,
  trainModelStep,
} from './engine/securityEngine';
import {
  STORAGE_SESSION_KEY,
  STORAGE_THEME_KEY,
  createFreshSession,
  generateRealisticEvent,
  loadSession,
} from './engine/eventGenerator';
import {
  initAudioUnlock,
  playTone,
  setAudioEnabled,
} from './utils/audioEngine';
import { exportSessionData } from './utils/exporters';
import { TOUR_STEPS } from './utils/tourSteps';
import {
  BackgroundCrystalWaves,
  CaseTelemetryHeader,
  SentinelBrandIcon,
} from './components/BrandAssets';
import DefenseLab from './components/DefenseLab';
import EngineeringSection from './components/EngineeringSection';
import {
  GuidedTourCard,
  HitlDecisionModal,
  LegalCompendiumModal,
} from './components/ModalsAndTour';

const NOTIF_SNOOZE_MS = 5 * 60 * 1000;

const FALLBACK_CHAPTERS = SPANISH_LEGAL_COMPENDIUM.map((item, idx) => ({
  ...item,
  chapter: `Cap. ${['I', 'II', 'III', 'IV', 'V'][idx] || idx + 1}`,
  boeId:
    ['BOE-A-2018-16036', 'BOE-A-2010-6737', 'BOE-A-2018-16673', 'BOE-A-2017-14334', 'BOE-A-2022-7191'][
      idx
    ] || 'BOE',
  boeUrl: `https://www.boe.es/buscar/act.php?id=${
    ['BOE-A-2018-16036', 'BOE-A-2010-6737', 'BOE-A-2018-16673', 'BOE-A-2017-14334', 'BOE-A-2022-7191'][
      idx
    ] || ''
  }`,
  lastConsolidated: item.updated,
  status: 'Vigente',
}));

export default function App() {
  const initial = useMemo(() => loadSession(), []);

  const [entered, setEntered] = useState(initial.entered);
  const [activeTab, setActiveTab] = useState(initial.activeTab);
  const [aiEnabled, setAiEnabled] = useState(initial.aiEnabled);
  const [autoStream, setAutoStream] = useState(initial.autoStream);
  const [model, setModel] = useState(initial.model);
  const [events, setEvents] = useState(initial.events);
  const [totals, setTotals] = useState(initial.totals);
  const seqRef = useRef(initial.seq || 9100);

  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [lawData, setLawData] = useState({
    chapters: FALLBACK_CHAPTERS,
    syncedAt: null,
    isSyncing: false,
  });

  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_THEME_KEY) || 'light';
    } catch {
      return 'light';
    }
  });
  const [tourStep, setTourStep] = useState(null);
  const [tourPos, setTourPos] = useState('bottom');
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef(null);

  const [selectedEventId, setSelectedEventId] = useState(null);
  const [noteInput, setNoteInput] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [aiScanning, setAiScanning] = useState(false);
  const [notifSnoozedUntil, setNotifSnoozedUntil] = useState(0);

  const [legalModalState, setLegalModalState] = useState({
    open: false,
    query: '',
  });

  const [aiLogs, setAiLogs] = useState([
    'Biblioteca normativa España lista: PSD2, Ley 10/2010 (SEPBLAC), RGPD y Banco de España.',
    'Regla activa: la IA solo aprueba automáticamente casos 100 % seguros; el resto pasa a ti.',
  ]);

  // Carga en vivo del compendio actualizado por GitHub Actions desde la API del BOE
  const fetchLiveLaws = useCallback(async () => {
    setLawData((prev) => ({ ...prev, isSyncing: true }));
    try {
      const base = import.meta.env.BASE_URL || '/';
      const res = await fetch(`${base}data/spanish-laws.json?t=${Date.now()}`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('Sin feed remoto');
      const json = await res.json();
      if (Array.isArray(json.chapters) && json.chapters.length > 0) {
        setLawData({
          chapters: json.chapters,
          syncedAt: json.syncedAt || null,
          isSyncing: false,
        });
        return;
      }
    } catch {
      // Mantiene compendio local de respaldo si está offline
    }
    setLawData((prev) => ({ ...prev, isSyncing: false }));
  }, []);

  useEffect(() => {
    fetchLiveLaws();
  }, [fetchLiveLaws]);

  // Detección real de conectividad (Verde = activo, Naranja = en pausa, Rojo = sin conexión)
  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => initAudioUnlock(), []);

  useEffect(() => {
    setAudioEnabled(soundEnabled);
  }, [soundEnabled]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_SESSION_KEY,
        JSON.stringify({
          entered,
          activeTab,
          aiEnabled,
          autoStream,
          seq: seqRef.current,
          model,
          events,
          totals,
        })
      );
    } catch {
      // Ignorar
    }
  }, [entered, activeTab, aiEnabled, autoStream, model, events, totals]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(STORAGE_THEME_KEY, theme);
    } catch {
      // Ignorar
    }
  }, [theme]);

  useEffect(() => {
    if (!exportOpen) return undefined;
    const handleOutside = (e) => {
      if (exportRef.current && !exportRef.current.contains(e.target)) {
        setExportOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [exportOpen]);

  useEffect(() => {
    if (!notifSnoozedUntil) return undefined;
    const wait = Math.max(0, notifSnoozedUntil - Date.now());
    const timer = setTimeout(() => setNotifSnoozedUntil(0), wait);
    return () => clearTimeout(timer);
  }, [notifSnoozedUntil]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (legalModalState.open) {
          setLegalModalState({ open: false, query: '' });
        } else if (selectedEventId) {
          setSelectedEventId(null);
          setNoteInput('');
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [legalModalState.open, selectedEventId]);

  useEffect(() => {
    if (tourStep === null) return undefined;
    const step = TOUR_STEPS[tourStep];
    if (!step) return undefined;

    setActiveTab(step.tab);
    const timer = setTimeout(() => {
      if (step.id === 'topbar-actions' || step.id === 'kpis') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setTourPos('bottom');
        return;
      }
      const el = document.getElementById(`tour-${step.id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => {
          const rect = el.getBoundingClientRect();
          const centerY = rect.top + rect.height / 2;
          setTourPos(centerY > window.innerHeight * 0.52 ? 'top' : 'bottom');
        }, 220);
      }
    }, 90);
    return () => clearTimeout(timer);
  }, [tourStep]);

  const pendingEvents = useMemo(
    () => events.filter((e) => e.status === 'PENDING'),
    [events]
  );
  const aiApprovedEvents = useMemo(
    () => events.filter((e) => e.status === 'AUTO_APPROVED'),
    [events]
  );

  // Métricas combinadas: pendientes en vivo + acumulados que NUNCA bajan
  const metrics = useMemo(() => {
    const pending = pendingEvents.length;
    const criticalPending = pendingEvents.filter(
      (e) => (e.risk?.score || 0) >= 75
    ).length;
    const pendingExposureEur = pendingEvents.reduce(
      (sum, e) => sum + (Number(e.amount) || 0),
      0
    );
    const humanResolved = totals.humanApproved + totals.humanBlocked;
    const totalResolved = totals.aiApproved + humanResolved;
    const threatLevel =
      pending >= 3 ? 'ELEVADO' : pending >= 1 ? 'VIGILANCIA' : 'CONTROLADO';

    let statusDetail = 'Óptimo · Sin riesgo activo';
    if (!aiEnabled && pending > 0) {
      statusDetail = `Manual (IA OFF) · ${pending} pendientes (${pendingExposureEur.toLocaleString('es-ES')} €)`;
    } else if (criticalPending >= 2 || pending >= 4) {
      statusDetail = `Crítico · ${criticalPending} críticos · ${pendingExposureEur.toLocaleString('es-ES')} € en riesgo`;
    } else if (pending > 0) {
      statusDetail = `Vigilancia · ${pending} en cola · ${pendingExposureEur.toLocaleString('es-ES')} € en revisión`;
    } else if (totals.protectedCapital > 0) {
      statusDetail = `Blindado · ${totals.humanBlocked} bloqueos efectivos`;
    }

    return {
      pending,
      criticalPending,
      pendingExposureEur,
      aiApproved: totals.aiApproved,
      humanResolved,
      blocked: totals.humanBlocked,
      totalResolved,
      protectedCapital: totals.protectedCapital,
      threatLevel,
      statusDetail,
    };
  }, [pendingEvents, totals, aiEnabled]);

  const correlatedPending = useMemo(() => {
    const byAccount = new Map();
    for (const evt of pendingEvents) {
      const list = byAccount.get(evt.account) || [];
      list.push(evt);
      byAccount.set(evt.account, list);
    }
    return Array.from(byAccount.entries()).map(([account, items]) => ({
      account,
      items,
      isCluster: items.length > 1,
      primary: items[0],
      maxScore: Math.max(...items.map((i) => i.risk.score)),
      totalAmount: items.reduce((s, i) => s + (i.amount || 0), 0),
    }));
  }, [pendingEvents]);

  const selectedEvent = useMemo(
    () => events.find((e) => e.id === selectedEventId) || null,
    [events, selectedEventId]
  );

  const appendAiLog = useCallback((line) => {
    setAiLogs((prev) => [line, ...prev].slice(0, 3));
  }, []);

  const processIncomingOperation = useCallback(
    (forceRisky = false) => {
      setAiScanning(true);
      setTimeout(() => {
        seqRef.current += 1;
        const evaluated = generateRealisticEvent(
          model,
          seqRef.current,
          forceRisky
        );

        if (!aiEnabled) {
          setEvents((prev) => [evaluated, ...prev].slice(0, 48));
          appendAiLog(
            `[${evaluated.timestamp}] IA APAGADA: ${evaluated.id} «${evaluated.title}» enviado directo a tus pendientes.`
          );
          playTone(evaluated.risk.score >= 75 ? 'criticalCalm' : 'alert');
        } else if (evaluated.risk.score === 0 && !forceRisky) {
          const autoSafeEvt = {
            ...evaluated,
            status: 'AUTO_APPROVED',
            note: 'Aprobado por IA (100 % seguro). Verificación humana disponible.',
          };
          setEvents((prev) => [autoSafeEvt, ...prev].slice(0, 48));
          setTotals((t) => ({ ...t, aiApproved: t.aiApproved + 1 }));
          appendAiLog(
            `[${evaluated.timestamp}] IA aprobó al 100 % de seguridad ${autoSafeEvt.id} «${autoSafeEvt.title}».`
          );
          playTone('autoOk');
        } else {
          setEvents((prev) => [evaluated, ...prev].slice(0, 48));
          appendAiLog(
            `[${evaluated.timestamp}] IA escaló ${evaluated.id} (${evaluated.risk.score} % riesgo) · ${evaluated.risk.legal.law}.`
          );
          playTone(evaluated.risk.score >= 75 ? 'criticalCalm' : 'alert');
        }
        setAiScanning(false);
      }, 360);
    },
    [aiEnabled, model, appendAiLog]
  );

  // Flujo continuo en vivo (sigue entrando con IA ON u OFF si hay conexión y no está en pausa)
  useEffect(() => {
    if (!entered || !autoStream || !isOnline || tourStep !== null) {
      return undefined;
    }
    const interval = setInterval(() => {
      if (pendingEvents.length >= 24) return;
      processIncomingOperation(false);
    }, 4200);
    return () => clearInterval(interval);
  }, [
    entered,
    autoStream,
    isOnline,
    tourStep,
    pendingEvents.length,
    processIncomingOperation,
  ]);

  const handleOpenModal = (evt) => {
    playTone('click');
    setActiveTab('console');
    setSelectedEventId(evt.id);
    setNoteInput(evt.note || '');
  };

  const handleOpenLegalModal = (query = '') => {
    playTone('click');
    setLegalModalState({ open: true, query });
  };

  const handleResolveEvent = (newStatus) => {
    if (!selectedEvent || isResolving) return;
    setIsResolving(true);
    const cleanNote = sanitizeNote(noteInput, 160);
    const label = newStatus === 'BLOCKED' ? 1 : 0;
    const prevStatus = selectedEvent.status;
    const amt = Number(selectedEvent.amount) || 0;

    const training = trainModelStep(model, selectedEvent, label, cleanNote);
    setModel(training.model);

    // Actualización estrictamente coherente de contadores acumulativos (total nunca baja)
    setTotals((prev) => {
      const next = { ...prev };
      if (prevStatus === 'PENDING') {
        if (newStatus === 'APPROVED') next.humanApproved += 1;
        else {
          next.humanBlocked += 1;
          next.protectedCapital += amt;
        }
      } else if (prevStatus === 'AUTO_APPROVED') {
        next.aiApproved = Math.max(0, next.aiApproved - 1);
        if (newStatus === 'APPROVED') next.humanApproved += 1;
        else {
          next.humanBlocked += 1;
          next.protectedCapital += amt;
        }
      } else if (prevStatus === 'APPROVED' && newStatus === 'BLOCKED') {
        next.humanApproved = Math.max(0, next.humanApproved - 1);
        next.humanBlocked += 1;
        next.protectedCapital += amt;
      } else if (prevStatus === 'BLOCKED' && newStatus === 'APPROVED') {
        next.humanBlocked = Math.max(0, next.humanBlocked - 1);
        next.humanApproved += 1;
        next.protectedCapital = Math.max(0, next.protectedCapital - amt);
      }
      return next;
    });

    setEvents((prev) =>
      prev.map((e) => {
        if (e.id === selectedEvent.id) {
          return {
            ...e,
            status: newStatus,
            note: cleanNote,
            risk: evaluateRiskEvent(e, training.model),
          };
        }
        if (e.status === 'PENDING') {
          return { ...e, risk: evaluateRiskEvent(e, training.model) };
        }
        return e;
      })
    );

    appendAiLog(
      `Decisión registrada: ${newStatus === 'BLOCKED' ? 'Denegaste' : 'Aprobaste'} ${selectedEvent.id} (riesgo recalibrado: ${training.prevScore}% → ${training.newScore}%).`
    );
    playTone(newStatus === 'BLOCKED' ? 'block' : 'approve');
    setSelectedEventId(null);
    setNoteInput('');
    setTimeout(() => setIsResolving(false), 180);
  };

  const handleExport = (format) => {
    playTone('export');
    setExportOpen(false);
    exportSessionData(format, { events, metrics, model });
  };

  const handleResetDemo = () => {
    playTone('click');
    try {
      localStorage.removeItem(STORAGE_SESSION_KEY);
    } catch {
      // Ignorar
    }
    const fresh = createFreshSession();
    seqRef.current = fresh.seq;
    setModel(fresh.model);
    setEvents(fresh.events);
    setTotals(fresh.totals);
    setAiEnabled(true);
    setAutoStream(true);
    setNotifSnoozedUntil(0);
    setSelectedEventId(null);
    setNoteInput('');
    setAiLogs([
      'Sesión reiniciada con nuevos casos aleatorios.',
      'Biblioteca normativa España sincronizada: PSD2, SEPBLAC, RGPD y Banco de España.',
    ]);
  };

  const currentTour = tourStep !== null ? TOUR_STEPS[tourStep] : null;
  const isSpot = (id) => currentTour?.id === id;
  const isDeckSpotlight = isSpot('kpis') || isSpot('topbar-actions');
  const activeAdvisoryEvent = pendingEvents[0] || events[0] || null;

  // Semáforo operativo: Rojo = Sin conexión · Naranja = En pausa/espera · Verde = Activo
  const sentinelState = !isOnline
    ? 'offline'
    : !autoStream
      ? 'paused'
      : 'active';

  const isAiOffline = sentinelState !== 'active' || !aiEnabled;

  const statusText =
    sentinelState === 'offline'
      ? 'SIN CONEXIÓN · MODO LOCAL'
      : sentinelState === 'paused'
        ? 'EN PAUSA (pulsa el escudo)'
        : aiScanning
          ? 'ANALIZANDO OPERACIÓN...'
          : `ACTIVO · IA ${aiEnabled ? 'ENCENDIDA' : 'APAGADA (MODO MANUAL)'}`;

  const showNotifications =
    !currentTour &&
    !selectedEvent &&
    !legalModalState.open &&
    pendingEvents.length > 0 &&
    notifSnoozedUntil <= Date.now();

  const capitalStatusClass =
    metrics.criticalPending >= 2 || metrics.pending >= 4
      ? 'cap-pill-danger'
      : metrics.pending > 0
        ? 'cap-pill-warn'
        : 'cap-pill-ok';

  const capitalStatusLabel = !aiEnabled
    ? 'MODO MANUAL'
    : metrics.criticalPending >= 2 || metrics.pending >= 4
      ? 'EXPOSICIÓN CRÍTICA'
      : metrics.pending > 0
        ? 'VIGILANCIA ACTIVA'
        : 'BLINDADO';

  if (!entered) {
    return (
      <>
        <BackgroundCrystalWaves />
        <main className="welcome-wrap">
          <section className="welcome-card animate-in">
            <div className="welcome-hero">
              <div className="lab-footer-row">
                <span className="pill-dark">
                  <SentinelBrandIcon size={26} /> Arquitectura Antifraude con
                  IA* Supervisada (HITL)
                </span>
                <button
                  className="btn-ghost-dark"
                  onClick={() => {
                    playTone('theme');
                    setTheme((t) => (t === 'light' ? 'dark' : 'light'));
                  }}
                >
                  {theme === 'light' ? 'Tema oscuro' : 'Tema claro'}
                </button>
              </div>
              <h1 className="welcome-title">
                Sentinel HITL: Seguridad de Accesos y Antifraude
              </h1>
              <p className="welcome-sub">
                Consola operativa en tiempo real diseñada para demostrar
                ingeniería Frontend avanzada, Machine Learning online con
                control humano, defensa HTTP 429, criptografía SHA-256,
                anti-CSRF/XSS y optimización real en RAM sobre hasta 30.000
                transacciones.
              </p>
              <div className="hero-specs mono">
                <span className="hero-spec-tag">LogReg Online + L2</span>
                <span className="hero-spec-tag">Rate Limiter HTTP 429</span>
                <span className="hero-spec-tag">Benchmark 30.000 ops</span>
                <span className="hero-spec-tag">Web Crypto SHA-256</span>
                <span className="hero-spec-tag">Anti-CSRF &amp; Anti-XSS</span>
                <span className="hero-spec-tag">Sync BOE + Vitest TDD</span>
              </div>
            </div>

            <div className="welcome-body">
              <div className="feature-grid">
                <article className="feature-box interactive-card">
                  <span className="step-num mono">01</span>
                  <h3>IA* + Biblioteca Legal BOE</h3>
                  <p>
                    Aprueba sola únicamente casos 100 % seguros (auditables) y
                    ofrece biblioteca normativa estructurada por capítulos.
                  </p>
                </article>
                <article className="feature-box interactive-card">
                  <span className="step-num mono">02</span>
                  <h3>6 Defensas Verificables (F12)</h3>
                  <p>
                    Pon a prueba HTTP 429, Anti-XSS, SHA-256, Idempotencia
                    Anti-CSRF y Diagnóstico de Seguridad en directo.
                  </p>
                </article>
                <article className="feature-box interactive-card">
                  <span className="step-num mono">03</span>
                  <h3>Rendimiento Real en RAM</h3>
                  <p>
                    Verifica en tu procesador cómo la agregación indexada
                    reduce más de un 70 % la latencia frente al patrón N+1.
                  </p>
                </article>
              </div>

              <div className="lab-footer-row">
                <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
                  <button
                    className="btn-primary"
                    onClick={() => {
                      playTone('approve');
                      setEntered(true);
                      setTourStep(0);
                    }}
                    style={{ padding: '0.95rem 1.8rem', fontSize: '1rem' }}
                  >
                    Iniciar visita guiada (6 pasos) →
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      playTone('click');
                      setEntered(true);
                      setTourStep(null);
                    }}
                    style={{ padding: '0.95rem 1.35rem', fontSize: '0.95rem' }}
                  >
                    Entrar directamente
                  </button>
                </div>
                <span
                  className="mono"
                  style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}
                >
                  *Modelo ML Online en cliente · Roberto Di Giovanni Igartua
                </span>
              </div>
            </div>
          </section>
        </main>
      </>
    );
  }

  return (
    <>
      <BackgroundCrystalWaves />
      {currentTour && <div className="tour-dimmer" aria-hidden="true" />}

      <div
        className={`sticky-command-deck ${currentTour ? 'tour-locked' : ''} ${
          isDeckSpotlight ? 'tour-elevated' : ''
        }`}
      >
        <header
          id="tour-topbar-actions"
          className={`topbar-wrap ${
            isSpot('topbar-actions')
              ? 'tour-spotlight-bar'
              : isSpot('kpis')
                ? 'tour-dimmed-part'
                : ''
          }`}
        >
          <div className="topbar">
            <div className="brand">
              <button
                className={`shield-4d-btn state-${sentinelState}`}
                onClick={() => {
                  playTone('click');
                  setAutoStream((s) => !s);
                }}
                title={
                  autoStream
                    ? 'Pulsa el escudo para PAUSAR el tráfico en vivo'
                    : 'Pulsa el escudo para REANUDAR el tráfico en vivo'
                }
                aria-label="Pausar o reanudar Sentinel HITL"
              >
                <SentinelBrandIcon size={36} paused={!autoStream} />
              </button>
              <div>
                <h1>Sentinel HITL</h1>
                <span className={`brand-sub mono text-state-${sentinelState}`}>
                  <span className={`live-dot state-${sentinelState}`} />
                  {statusText}
                </span>
              </div>
            </div>

            <div className="topbar-actions">
              {tourStep === null && (
                <button
                  className="btn-guide-cta"
                  onClick={() => {
                    playTone('click');
                    setTourStep(0);
                  }}
                >
                  Guía interactiva
                </button>
              )}

              <button
                className={`btn-ghost-dark btn-ai-toggle ${aiEnabled ? 'is-on' : 'is-off'}`}
                onClick={() => {
                  playTone('click');
                  setAiEnabled((v) => !v);
                }}
                title="Si apagas la IA, los casos siguen llegando y pasan todos a tus pendientes"
              >
                {aiEnabled ? 'IA: ON' : 'IA: OFF'}
              </button>

              <div className="export-wrap" ref={exportRef}>
                <button
                  className="btn-ghost-dark"
                  onClick={() => {
                    playTone('click');
                    setExportOpen((o) => !o);
                  }}
                >
                  Exportar ▾
                </button>
                {exportOpen && (
                  <div className="export-menu animate-in">
                    <button
                      className="export-item"
                      onClick={() => handleExport('csv')}
                    >
                      <span>Dataset Excel (Agrupado)</span>
                      <span className="export-ext mono">.CSV</span>
                    </button>
                    <button
                      className="export-item"
                      onClick={() => handleExport('txt')}
                    >
                      <span>Informe Ejecutivo</span>
                      <span className="export-ext mono">.TXT</span>
                    </button>
                    <button
                      className="export-item"
                      onClick={() => handleExport('json')}
                    >
                      <span>Modelo ML e Incidentes</span>
                      <span className="export-ext mono">.JSON</span>
                    </button>
                  </div>
                )}
              </div>

              <span className="topbar-divider" />

              <button
                className="btn-ghost-dark"
                onClick={() => {
                  playTone('theme');
                  setTheme((t) => (t === 'light' ? 'dark' : 'light'));
                }}
              >
                {theme === 'light' ? 'Oscuro' : 'Claro'}
              </button>
              <button
                className="btn-ghost-dark"
                onClick={() => setSoundEnabled((s) => !s)}
              >
                {soundEnabled ? 'Sonido: ON' : 'Sonido: OFF'}
              </button>

              <span className="topbar-divider" />

              <button className="btn-ghost-dark" onClick={handleResetDemo}>
                Reiniciar
              </button>
              <button
                className="btn-ghost-dark"
                onClick={() => {
                  playTone('click');
                  setEntered(false);
                }}
              >
                Portada
              </button>
            </div>
          </div>
        </header>

        <div className="deck-inner">
          <section
            id="tour-kpis"
            className={`kpi-grid ${
              isSpot('kpis')
                ? 'tour-spotlight'
                : isSpot('topbar-actions')
                  ? 'tour-dimmed-part'
                  : ''
            }`}
            aria-label="Métricas principales"
          >
            <div className="card kpi-card interactive-card">
              <div className="kpi-label">Tus Casos Pendientes</div>
              <div className="kpi-value mono">{metrics.pending}</div>
              <div className="kpi-sub">
                {metrics.criticalPending > 0
                  ? `${metrics.criticalPending} críticos requieren acción`
                  : 'Esperando decisión humana'}
              </div>
            </div>
            <div className="card kpi-card interactive-card">
              <div className="kpi-label">Aprobados por IA</div>
              <div className="kpi-value mono" style={{ color: 'var(--accent)' }}>
                {metrics.aiApproved}
              </div>
              <div className="kpi-sub">Solo 100 % seguros (auditables)</div>
            </div>
            <div className="card kpi-card interactive-card">
              <div className="kpi-label">Resueltos en Total</div>
              <div className="kpi-value mono">{metrics.totalResolved}</div>
              <div className="kpi-sub">
                {metrics.humanResolved} humano · {metrics.aiApproved} IA
              </div>
            </div>
            <div className="card kpi-card kpi-capital interactive-card">
              <div className="kpi-capital-top">
                <div className="kpi-label">Capital Protegido</div>
                <span className={`cap-pill mono ${capitalStatusClass}`}>
                  {capitalStatusLabel}
                </span>
              </div>
              <div className="kpi-value kpi-capital-amount mono">
                {metrics.protectedCapital.toLocaleString('es-ES')} €
              </div>
              <div className="kpi-capital-meta">
                {metrics.pendingExposureEur > 0 ? (
                  <>
                    <span className="cap-exposure mono">
                      {metrics.pendingExposureEur.toLocaleString('es-ES')} € en
                      riesgo
                    </span>
                    <span className="cap-sep">·</span>
                    <span>{metrics.criticalPending} críticos</span>
                  </>
                ) : (
                  <span style={{ color: 'var(--success)', fontWeight: 700 }}>
                    Sin exposición pendiente · {metrics.blocked} bloqueos
                  </span>
                )}
              </div>
            </div>
          </section>

          <nav
            className={`tabs ${isDeckSpotlight ? 'tour-dimmed-part' : ''}`}
            aria-label="Secciones principales"
          >
            <button
              className={`tab-btn ${activeTab === 'console' ? 'active' : ''}`}
              onClick={() => {
                playTone('tab');
                setActiveTab('console');
              }}
            >
              1. Supervisión IA ({metrics.pending})
            </button>
            <button
              className={`tab-btn ${activeTab === 'lab' ? 'active' : ''}`}
              onClick={() => {
                playTone('tab');
                setActiveTab('lab');
              }}
            >
              2. Defensa y Rendimiento (6)
            </button>
            <button
              className={`tab-btn ${activeTab === 'quality' ? 'active' : ''}`}
              onClick={() => {
                playTone('tab');
                setActiveTab('quality');
              }}
            >
              3. Ingeniería y Autor
            </button>
          </nav>
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <div className={`app-shell ${currentTour ? 'tour-locked' : ''}`}>
        {activeTab === 'console' && (
          <section className="animate-in">
            <div className="section-header-block">
              <span className="section-eyebrow mono">
                MÓDULO 01 · CENTRO DE OPERACIONES HITL
              </span>
              <h2>Supervisión Antifraude y Biblioteca Normativa en Vivo</h2>
              <p>
                La IA aprueba únicamente casos 100 % seguros (revisables a la
                derecha) y te asiste con la legislación española en cada alerta.
              </p>
            </div>

            <div
              id="tour-ai-monitor"
              className={`ai-monitor ${isAiOffline ? 'is-offline' : ''} ${
                isSpot('ai-monitor') ? 'tour-spotlight' : ''
              }`}
            >
              {!isAiOffline && (
                <div className={`ai-scan-bar ${aiScanning ? 'fast' : ''}`} />
              )}
              <div className="lab-footer-row">
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    flexWrap: 'wrap',
                  }}
                >
                  <strong
                    style={{
                      fontSize: '1.05rem',
                      color: isAiOffline ? '#94a3b8' : '#7dd3fc',
                    }}
                  >
                    Cerebro Sentinel AI · Biblioteca Normativa (BOE)
                  </strong>
                  {isAiOffline ? (
                    <span className="monitor-status-text mono tone-warn">
                      ●{' '}
                      {sentinelState === 'offline'
                        ? 'SIN CONEXIÓN'
                        : sentinelState === 'paused'
                          ? 'EN PAUSA · PULSA EL ESCUDO'
                          : 'IA APAGADA · MODO MANUAL'}
                    </span>
                  ) : (
                    <button
                      className="legal-trigger-btn"
                      onClick={() => handleOpenLegalModal('')}
                    >
                      Abrir biblioteca por capítulos ↗
                    </button>
                  )}
                </div>

                <button
                  className="btn-guide-cta"
                  style={{ padding: '0.38rem 0.82rem', fontSize: '0.82rem' }}
                  onClick={() => processIncomingOperation(true)}
                  disabled={aiScanning}
                >
                  + Generar caso complejo
                </button>
              </div>

              <div className="legal-grid">
                <div className="legal-box">
                  <div className="lab-footer-row" style={{ marginBottom: '0.4rem' }}>
                    <span
                      className="mono"
                      style={{ fontSize: '0.78rem', color: '#38bdf8' }}
                    >
                      NORMATIVA APLICABLE · {activeAdvisoryEvent?.id || 'EN ESPERA'}
                    </span>
                    {activeAdvisoryEvent && (
                      <button
                        className="legal-trigger-btn"
                        style={{ padding: '0.2rem 0.55rem', fontSize: '0.74rem' }}
                        onClick={() =>
                          handleOpenLegalModal(
                            activeAdvisoryEvent.risk.legal?.law.split(' ')[0] || ''
                          )
                        }
                      >
                        Leer capítulo completo ↗
                      </button>
                    )}
                  </div>
                  {activeAdvisoryEvent ? (
                    <>
                      <strong
                        style={{
                          display: 'block',
                          fontSize: '0.98rem',
                          marginBottom: '0.3rem',
                        }}
                      >
                        {activeAdvisoryEvent.risk.legal?.law}
                      </strong>
                      <div style={{ color: '#cbd5e1', marginBottom: '0.35rem' }}>
                        <strong>Vacío / Riesgo:</strong>{' '}
                        {activeAdvisoryEvent.risk.legal?.gap}
                      </div>
                      <div style={{ color: '#6ee7b7' }}>
                        <strong>Guía para el agente:</strong>{' '}
                        {activeAdvisoryEvent.risk.legal?.guidance}
                      </div>
                    </>
                  ) : (
                    <span>Sin casos pendientes de asesoría.</span>
                  )}
                </div>

                <div className="legal-box">
                  <div
                    className="mono"
                    style={{
                      fontSize: '0.78rem',
                      color: '#94a3b8',
                      marginBottom: '0.45rem',
                    }}
                  >
                    FEEDBACK EN VIVO
                  </div>
                  <ul className="ai-log-list">
                    {aiLogs.map((log, idx) => (
                      <li key={`${idx}-${log}`}>
                        <span style={{ color: '#38bdf8' }}>›</span>
                        <span>{log}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div
              id="tour-event-queue"
              className={`queue-columns ${isSpot('event-queue') ? 'tour-spotlight' : ''}`}
            >
              <div>
                <div className="column-header-bar">
                  <h3>Tus Casos Pendientes</h3>
                  <span className="col-counter mono tone-critical">
                    {pendingEvents.length}
                  </span>
                </div>
                <div className="event-list">
                  {correlatedPending.length === 0 ? (
                    <div className="card" style={{ textAlign: 'center' }}>
                      <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                        No hay amenazas pendientes. El flujo sigue vigilando en
                        vivo.
                      </p>
                    </div>
                  ) : (
                    correlatedPending.map((group) => {
                      const evt = group.primary;
                      return (
                        <article
                          key={group.account + evt.id}
                          className={`event-item interactive-card animate-in ${
                            group.isCluster
                              ? 'is-grouped'
                              : evt.risk.level === 'CRÍTICO'
                                ? 'is-critical'
                                : ''
                          }`}
                        >
                          <div style={{ flex: '1 1 260px' }}>
                            <CaseTelemetryHeader
                              evt={{
                                ...evt,
                                risk: { ...evt.risk, score: group.maxScore },
                              }}
                              clusterCount={group.items.length}
                            />
                            <strong className="case-title">
                              {group.isCluster
                                ? `Múltiples alertas en ${group.account}`
                                : evt.title}
                              {group.totalAmount > 0
                                ? ` · ${group.totalAmount.toLocaleString('es-ES')} €`
                                : ''}
                            </strong>
                            <div
                              style={{
                                fontSize: '0.86rem',
                                color: 'var(--text-muted)',
                                marginTop: '0.2rem',
                              }}
                            >
                              {evt.account} · {evt.location} ·{' '}
                              {evt.channel || 'Web'} ·{' '}
                              <span className="mono">{evt.timestamp}</span>
                            </div>
                            {group.isCluster && (
                              <ul
                                style={{
                                  margin: '0.5rem 0 0',
                                  paddingLeft: '1.1rem',
                                  fontSize: '0.84rem',
                                  color: 'var(--text)',
                                }}
                              >
                                {group.items.map((sub) => (
                                  <li key={sub.id}>
                                    <span className="mono">{sub.id}</span>:{' '}
                                    {sub.title} ({sub.risk.score} %)
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                          <button
                            className="btn-primary"
                            onClick={() => handleOpenModal(evt)}
                          >
                            Revisar
                          </button>
                        </article>
                      );
                    })
                  )}
                </div>
              </div>

              <div>
                <div className="column-header-bar">
                  <h3>Aprobados por IA · 100 % Seguros</h3>
                  <span className="col-counter mono tone-ok">
                    {aiApprovedEvents.length}
                  </span>
                </div>
                <div className="event-list">
                  {aiApprovedEvents.length === 0 ? (
                    <div className="card" style={{ textAlign: 'center' }}>
                      <p
                        style={{
                          margin: 0,
                          fontSize: '0.9rem',
                          color: 'var(--text-muted)',
                        }}
                      >
                        Aún no hay casos 100 % seguros aprobados por la IA.
                      </p>
                    </div>
                  ) : (
                    aiApprovedEvents.map((evt) => (
                      <div
                        key={evt.id}
                        className="compact-card interactive-card animate-in"
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <CaseTelemetryHeader evt={evt} />
                          <strong className="case-title-compact">
                            {evt.title}
                            {evt.amount > 0
                              ? ` · ${evt.amount.toLocaleString('es-ES')} €`
                              : ''}
                          </strong>
                          <span
                            style={{
                              fontSize: '0.8rem',
                              color: 'var(--text-muted)',
                            }}
                          >
                            {evt.account} · {evt.location}
                          </span>
                        </div>
                        <button
                          className="btn-secondary"
                          style={{ padding: '0.44rem 0.78rem', fontSize: '0.82rem' }}
                          onClick={() => handleOpenModal(evt)}
                        >
                          Verificar
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'lab' && (
          <DefenseLab isSpotlight={isSpot('lab-grid')} />
        )}

        {activeTab === 'quality' && (
          <EngineeringSection
            isSpotlight={isSpot('quality-author')}
            metrics={metrics}
            model={model}
          />
        )}

        {showNotifications && (
          <aside className="toast-stack" aria-live="polite">
            <div className="toast-card animate-in">
              <div className="lab-footer-row" style={{ marginBottom: '0.45rem' }}>
                <span className="status-inline-text mono tone-critical">
                  ● {pendingEvents.length}{' '}
                  {pendingEvents.length === 1
                    ? 'CASO PENDIENTE'
                    : 'CASOS PENDIENTES'}
                </span>
                <button
                  className="btn-secondary"
                  style={{ padding: '0.2rem 0.55rem', fontSize: '0.82rem' }}
                  onClick={() => {
                    playTone('click');
                    setNotifSnoozedUntil(Date.now() + NOTIF_SNOOZE_MS);
                  }}
                  title="Ocultar aviso durante 5 minutos"
                  aria-label="Cerrar aviso temporalmente"
                >
                  ×
                </button>
              </div>
              <strong style={{ display: 'block', fontSize: '0.95rem' }}>
                {pendingEvents.length > 3
                  ? `Tienes ${pendingEvents.length} casos esperando revisión`
                  : pendingEvents[0].title}
              </strong>
              <div
                style={{
                  fontSize: '0.82rem',
                  color: 'var(--text-muted)',
                  margin: '0.25rem 0 0.65rem',
                }}
              >
                Si cierras este aviso, reaparecerá en 5 min si quedan casos.
              </div>
              <button
                className="btn-primary"
                style={{ width: '100%', padding: '0.52rem' }}
                onClick={() => handleOpenModal(pendingEvents[0])}
              >
                Revisar en la cola →
              </button>
            </div>
          </aside>
        )}
      </div>

      <GuidedTourCard
        tourStep={tourStep}
        tourPos={tourPos}
        onChangeStep={setTourStep}
        onClose={() => setTourStep(null)}
      />

      <LegalCompendiumModal
        key={legalModalState.open ? legalModalState.query : 'closed'}
        open={legalModalState.open && !currentTour}
        chapters={lawData.chapters}
        syncedAt={lawData.syncedAt}
        isSyncing={lawData.isSyncing}
        initialQuery={legalModalState.query}
        onRefresh={fetchLiveLaws}
        onClose={() => setLegalModalState({ open: false, query: '' })}
      />

      <HitlDecisionModal
        event={!currentTour ? selectedEvent : null}
        noteInput={noteInput}
        onChangeNote={setNoteInput}
        isResolving={isResolving}
        onClose={() => {
          setSelectedEventId(null);
          setNoteInput('');
        }}
        onResolve={handleResolveEvent}
        onOpenLaw={(kw) => {
          setSelectedEventId(null);
          handleOpenLegalModal(kw);
        }}
      />
    </>
  );
}