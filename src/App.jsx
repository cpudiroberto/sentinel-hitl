import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FEATURE_META,
  computeDashboardMetrics,
  createInitialModel,
  createRateLimiter,
  evaluateRiskEvent,
  runQueryBenchmark,
  sanitizeNote,
  trainModelStep,
} from './engine/securityEngine';

const STORAGE_MODEL_KEY = 'sentinel_hitl_model_v3';
const STORAGE_EVENTS_KEY = 'sentinel_hitl_events_v3';
const STORAGE_THEME_KEY = 'sentinel_hitl_theme_v1';

const GITHUB_PROFILE_URL = 'https://github.com/cpudiroberto';
const LINKEDIN_URL =
  'https://www.linkedin.com/in/roberto-di-giovanni-igartua-718338209/';

const SentinelLogo = ({ size = 26 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <path
      d="M16 3L27 7.5V15.5C27 22.2 22.3 27.6 16 29.5C9.7 27.6 5 22.2 5 15.5V7.5L16 3Z"
      stroke="#ffffff"
      strokeWidth="2.2"
      fill="rgba(255,255,255,0.12)"
    />
    <circle cx="16" cy="15" r="4" fill="#38bdf8" />
    <path d="M16 9V11M16 19V22M10 15H12M20 15H22" stroke="#bae6fd" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const CpuIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="4" y="4" width="16" height="16" rx="2" />
    <rect x="9" y="9" width="6" height="6" />
    <path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3" />
  </svg>
);

const TOUR_STEPS = [
  {
    id: 'kpis',
    tab: 'console',
    title: 'Marcadores Separados en Tiempo Real',
    what: 'Separa exactamente las alertas pendientes de ti, las resueltas por la IA (solo 100% seguras o 100% ataque), las resueltas por ti y el capital protegido.',
    why: 'Evita mezclar métricas humanas con automáticas y garantiza trazabilidad total.',
    how: 'Fíjate en cómo cada contador cambia de forma independiente según quién actúe.',
  },
  {
    id: 'ai-monitor',
    tab: 'console',
    title: 'Cerebro Sentinel AI · Evaluación y Aprendizaje Sutil',
    what: 'Modelo real de Regresión Logística que calcula porcentajes personalizados y aprende con suavidad de tus decisiones y notas sin sobreajustarse.',
    why: 'Solo aprueba automáticamente operaciones con 100% de seguridad (0% riesgo); cualquier duda (1%–99%) pasa a ti.',
    how: 'Observa las 6 barras de sensibilidad y usa los botones rápidos para controlar el tráfico o lanzar escenarios.',
  },
  {
    id: 'event-queue',
    tab: 'console',
    title: 'Cola de Cooperación y Verificación de IA',
    what: 'Incluye 3 vistas separadas: Pendientes (HITL), Verificación IA (para auditar las aprobadas al 100% seguras) e Historial de bloqueos.',
    why: 'Incluso cuando la IA aprueba al 100% de seguridad, el humano conserva el control para verificar o revertir.',
    how: 'Cambia entre las sub-pestañas de la cola y pulsa «Revisar» en cualquier tarjeta.',
  },
  {
    id: 'lab-429',
    tab: 'lab',
    title: 'Escudo Antibots del Acceso (HTTP 429)',
    what: 'Protección real integrada para la puerta de entrada de operadores (/api/auth/login).',
    why: 'Bloquea automáticamente cualquier origen que supere 5 intentos fallidos en 60 segundos.',
    how: 'Pulsa «Simular intento de acceso» 6 veces seguidas para disparar el bloqueo HTTP 429 con cuenta atrás.',
  },
  {
    id: 'lab-n1',
    tab: 'lab',
    title: 'Motor de Consultas Real (15.000 Operaciones)',
    what: 'Genera en memoria 15.000 transacciones reales y cronometra en tu CPU dos formas de calcular los saldos por cliente.',
    why: 'Pedir datos cliente por cliente (N+1) satura el sistema; agrupar en una sola pasada (Map/GROUP BY) reduce la latencia en más de un 70%.',
    how: 'Cambia el número de clientes o pulsa «Ejecutar medición real» para ver tiempos y totales verificables.',
  },
  {
    id: 'quality-author',
    tab: 'quality',
    title: 'Ingeniería, Manual de 1 Hoja y Autor',
    what: 'Resumen técnico del proyecto, descarga del manual ejecutivo en 1 sola página y enlaces a LinkedIn y GitHub.',
    why: 'Permite revisar la arquitectura completa y llevarse una ficha técnica lista para imprimir o compartir.',
    how: 'Pulsa «Descargar Manual (1 hoja)» o abre los perfiles de Roberto Di Giovanni.',
  },
  {
    id: 'topbar-actions',
    tab: 'quality',
    title: 'Controles Superiores y Exportación',
    what: 'Reúne el cambio de tema (Claro/Oscuro), Sonido, Exportación de datos (.CSV, .TXT, .JSON), Reinicio y Portada.',
    why: 'Permite descargar todo el historial y los pesos del modelo para análisis posterior en Excel o Python.',
    how: 'Pulsa «Finalizar guía» para operar libremente toda la consola.',
  },
];

const INITIAL_SCENARIOS = [
  {
    id: 'EVT-9041',
    type: 'FINANCIAL',
    difficulty: 'Sofisticada',
    title: 'Transferencia internacional a proveedor nuevo',
    account: 'ES91 •••• 4821 (Tesorería Corp.)',
    amount: 3400,
    foreignCountry: true,
    location: 'Singapur (SG)',
    unusualHour: false,
    timestamp: '09:14 UTC',
  },
  {
    id: 'EVT-9042',
    type: 'ACCESS',
    difficulty: 'Media',
    title: 'Acceso remoto desde dispositivo no habitual',
    account: 'admin.finanzas@empresa.es',
    impossibleTravel: false,
    location: 'Lisboa (PT)',
    unknownDevice: true,
    failedAttempts: 3,
    timestamp: '09:16 UTC',
  },
];

// Generador procedimental de casos variados con niveles de dificultad
const CASE_TEMPLATES = [
  { type: 'FINANCIAL', difficulty: 'Básica', title: 'Pago de nómina mensual nacional', account: 'ES21 •••• 3301 (RRHH)', amount: 1200, foreignCountry: false, location: 'Madrid (ES)', unusualHour: false },
  { type: 'ACCESS', difficulty: 'Básica', title: 'Inicio de sesión habitual desde oficina', account: 'laura.gomez@empresa.es', amount: 0, impossibleTravel: false, location: 'Barcelona (ES)', unknownDevice: false, failedAttempts: 0 },
  { type: 'FINANCIAL', difficulty: 'Básica', title: 'Domiciliación eléctrica recurrente', account: 'ES18 •••• 9912 (Suministros)', amount: 310, foreignCountry: false, location: 'Valencia (ES)', unusualHour: false },
  { type: 'FINANCIAL', difficulty: 'Básica', title: 'Liquidación trimestral AEAT', account: 'ES04 •••• 8810 (Fiscalidad)', amount: 890, foreignCountry: false, location: 'Madrid (ES)', unusualHour: false },
  { type: 'FINANCIAL', difficulty: 'Media', title: 'Pago fraccionado a proveedor europeo', account: 'ES44 •••• 1093 (Operativa)', amount: 2150, foreignCountry: true, location: 'Bucarest (RO)', unusualHour: false },
  { type: 'ACCESS', difficulty: 'Media', title: 'Acceso a panel de pagos con fallos de clave', account: 'svc-pagos@empresa.es', amount: 0, impossibleTravel: false, location: 'Frankfurt (DE)', unknownDevice: true, failedAttempts: 3 },
  { type: 'FINANCIAL', difficulty: 'Media', title: 'Compra de licencias cloud en divisa extranjera', account: 'ES63 •••• 4402 (IT Corp.)', amount: 2950, foreignCountry: true, location: 'San Francisco (US)', unusualHour: false },
  { type: 'ACCESS', difficulty: 'Media', title: 'Cambio de contraseña desde red pública', account: 'marta.sanz@empresa.es', amount: 0, impossibleTravel: false, location: 'Londres (UK)', unknownDevice: true, failedAttempts: 2 },
  { type: 'FINANCIAL', difficulty: 'Sofisticada', title: 'Transferencia nocturna a filial externa', account: 'ES55 •••• 2219 (Operaciones)', amount: 4100, foreignCountry: true, location: 'Varsovia (PL)', unusualHour: true },
  { type: 'FINANCIAL', difficulty: 'Crítica', title: 'Vaciado de tesorería a cuenta offshore', account: 'ES77 •••• 6510 (Tesorería)', amount: 7500, foreignCountry: true, unusualHour: true, impossibleTravel: true, unknownDevice: true, failedAttempts: 5, location: 'Islas Caimán (KY)' },
  { type: 'ACCESS', difficulty: 'Crítica', title: 'Secuestro de cuenta admin con viaje imposible', account: 'root.finanzas@empresa.es', amount: 0, foreignCountry: true, unusualHour: true, impossibleTravel: true, unknownDevice: true, failedAttempts: 6, location: 'Madrid → Tokio (8 min)' },
  { type: 'FINANCIAL', difficulty: 'Crítica', title: 'Retirada urgente tras fuerza bruta confirmada', account: 'ES12 •••• 7730 (Fondo Liquidez)', amount: 6800, foreignCountry: true, unusualHour: true, impossibleTravel: true, unknownDevice: true, failedAttempts: 4, location: 'Dubái (AE)' },
];

function buildEvaluatedEvent(raw, model) {
  const risk = evaluateRiskEvent(raw, model);
  return { ...raw, risk, status: 'PENDING', note: '' };
}

function loadSavedModel() {
  try {
    const raw = localStorage.getItem(STORAGE_MODEL_KEY);
    if (!raw) return createInitialModel();
    const parsed = JSON.parse(raw);
    if (parsed && parsed.weights && typeof parsed.bias === 'number') {
      return parsed;
    }
  } catch {
    // Fallback
  }
  return createInitialModel();
}

function loadSavedEvents(model) {
  try {
    const raw = localStorage.getItem(STORAGE_EVENTS_KEY);
    if (!raw) {
      return INITIAL_SCENARIOS.map((s) => buildEvaluatedEvent(s, model));
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {
    // Fallback
  }
  return INITIAL_SCENARIOS.map((s) => buildEvaluatedEvent(s, model));
}

function loadSavedTheme() {
  try {
    return localStorage.getItem(STORAGE_THEME_KEY) || 'light';
  } catch {
    return 'light';
  }
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function App() {
  const [entered, setEntered] = useState(false);
  const [theme, setTheme] = useState(() => loadSavedTheme());
  const [activeTab, setActiveTab] = useState('console');
  const [queueFilter, setQueueFilter] = useState('pending'); // 'pending' | 'ai_verify' | 'history'
  const [tourStep, setTourStep] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);

  const [model, setModel] = useState(() => loadSavedModel());
  const [events, setEvents] = useState(() => loadSavedEvents(loadSavedModel()));
  const [autoStream, setAutoStream] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [noteInput, setNoteInput] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [aiScanning, setAiScanning] = useState(false);

  const [aiLogs, setAiLogs] = useState([
    'IA activa: solo aprueba automáticamente al 100% de seguridad (0% riesgo) y bloquea ataques al 100%.',
    'Aprendizaje sutil activo: tus decisiones recalibran el modelo con regularización anti-sesgo.',
  ]);

  const currentTour = tourStep !== null ? TOUR_STEPS[tourStep] : null;

  useEffect(() => {
    if (!currentTour) return;
    setActiveTab(currentTour.tab);
    const timer = setTimeout(() => {
      if (currentTour.id === 'topbar-actions') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      const el = document.getElementById(`tour-${currentTour.id}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 90);
    return () => clearTimeout(timer);
  }, [tourStep]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(STORAGE_THEME_KEY, theme);
    } catch {
      // Ignorar
    }
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_MODEL_KEY, JSON.stringify(model));
    } catch {
      // Ignorar
    }
  }, [model]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_EVENTS_KEY, JSON.stringify(events));
    } catch {
      // Ignorar
    }
  }, [events]);

  const audioCtxRef = useRef(null);
  const playTone = (kind) => {
    if (!soundEnabled || typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current) audioCtxRef.current = new AudioCtx();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      if (kind === 'alert') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(660, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.22);
      } else if (kind === 'autoBlock') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(420, now);
        osc.frequency.exponentialRampToValueAtTime(210, now + 0.16);
        gain.gain.setValueAtTime(0.07, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      } else if (kind === 'autoOk') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(520, now + 0.06);
        gain.gain.setValueAtTime(0.03, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (kind === 'click') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(580, now);
        gain.gain.setValueAtTime(0.035, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
      } else if (kind === 'block') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(175, now + 0.15);
        gain.gain.setValueAtTime(0.09, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
        osc.start(now);
        osc.stop(now + 0.19);
      } else if (kind === 'approve') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.exponentialRampToValueAtTime(780, now + 0.15);
        gain.gain.setValueAtTime(0.07, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      } else if (kind === 'error429') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(190, now);
        osc.frequency.linearRampToValueAtTime(135, now + 0.18);
        gain.gain.setValueAtTime(0.07, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.22);
      }
    } catch {
      // Silencio seguro
    }
  };

  const limiterRef = useRef(
    createRateLimiter({ maxAttempts: 5, windowMs: 60000 })
  );
  const [loginStatus, setLoginStatus] = useState({
    status: 200,
    attempts: 0,
    maxAttempts: 5,
    retryAfterSec: 0,
    message: 'Puerta de acceso de operadores (/api/auth/login) lista.',
  });

  const [clientCount, setClientCount] = useState(40);
  const [benchRunId, setBenchRunId] = useState(0);
  const benchmark = useMemo(
    () => runQueryBenchmark(clientCount, 15000),
    [clientCount, benchRunId]
  );

  const metrics = useMemo(() => computeDashboardMetrics(events), [events]);
  const pendingEvents = useMemo(
    () => events.filter((e) => e.status === 'PENDING'),
    [events]
  );
  const aiVerifyEvents = useMemo(
    () => events.filter((e) => e.status === 'AUTO_APPROVED'),
    [events]
  );
  const historyEvents = useMemo(
    () =>
      events.filter(
        (e) =>
          e.status === 'APPROVED' ||
          e.status === 'BLOCKED' ||
          e.status === 'AUTO_BLOCKED'
      ),
    [events]
  );

  const visibleEvents =
    queueFilter === 'pending'
      ? pendingEvents
      : queueFilter === 'ai_verify'
        ? aiVerifyEvents
        : historyEvents;

  const selectedEvent = useMemo(
    () => events.find((e) => e.id === selectedEventId) || null,
    [events, selectedEventId]
  );

  const trafficIndexRef = useRef(0);
  const eventSeqRef = useRef(9050);

  const appendAiLog = (line) => {
    setAiLogs((prev) => [line, ...prev].slice(0, 3));
  };

  const processIncomingOperation = (forceRisky = false) => {
    setAiScanning(true);
    let template =
      CASE_TEMPLATES[trafficIndexRef.current % CASE_TEMPLATES.length];
    trafficIndexRef.current += 1;

    if (forceRisky) {
      const riskyPool = CASE_TEMPLATES.filter(
        (item) => item.difficulty !== 'Básica'
      );
      template = riskyPool[trafficIndexRef.current % riskyPool.length];
    }

    const now = new Date();
    const timeStr = now.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    // Variación ligera de importe para casos únicos
    const amountJitter =
      template.amount > 0 ? Math.round((Math.random() - 0.5) * 180) : 0;

    setTimeout(() => {
      eventSeqRef.current += 1;
      const evaluated = buildEvaluatedEvent(
        {
          ...template,
          amount: Math.max(0, (template.amount || 0) + amountJitter),
          id: `EVT-${eventSeqRef.current}`,
          timestamp: timeStr,
        },
        model
      );

      // Solo aprueba automáticamente si es 100% segura (riesgo 0%)
      if (evaluated.risk.score === 0 && !forceRisky) {
        const autoSafeEvt = {
          ...evaluated,
          status: 'AUTO_APPROVED',
          note: 'Aprobada por IA (100% segura). Disponible para verificación humana.',
        };
        setEvents((prev) => [autoSafeEvt, ...prev].slice(0, 24));
        appendAiLog(
          `[${timeStr}] IA aprobó al 100% de seguridad ${autoSafeEvt.id} «${autoSafeEvt.title}» (auditable).`
        );
        playTone('autoOk');
      } else if (evaluated.risk.score === 100) {
        const autoBlockedEvt = {
          ...evaluated,
          status: 'AUTO_BLOCKED',
          note: 'Bloqueo autónomo de la IA (certeza 100%).',
        };
        setEvents((prev) => [autoBlockedEvt, ...prev].slice(0, 24));
        appendAiLog(
          `[${timeStr}] IA BLOQUEÓ AL 100% ${autoBlockedEvt.id} «${autoBlockedEvt.title}».`
        );
        playTone('autoBlock');
      } else {
        setEvents((prev) => [evaluated, ...prev].slice(0, 24));
        appendAiLog(
          `[${timeStr}] IA escaló ${evaluated.id} (${evaluated.risk.threatCategory} · ${evaluated.risk.score}%) → Esperando decisión humana.`
        );
        playTone('alert');
      }
      setAiScanning(false);
    }, 420);
  };

  useEffect(() => {
    if (!entered || !autoStream || tourStep !== null) return undefined;
    const interval = setInterval(() => {
      if (pendingEvents.length >= 6) return;
      processIncomingOperation(false);
    }, 3500);
    return () => clearInterval(interval);
  }, [entered, autoStream, tourStep, pendingEvents.length, model]);

  useEffect(() => {
    if (loginStatus.retryAfterSec <= 0) return undefined;
    const interval = setInterval(() => {
      setLoginStatus((prev) => {
        if (prev.retryAfterSec <= 1) {
          return {
            ...prev,
            status: 200,
            retryAfterSec: 0,
            message: 'Ventana liberada. Puerta de acceso operativa de nuevo.',
          };
        }
        return { ...prev, retryAfterSec: prev.retryAfterSec - 1 };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [loginStatus.retryAfterSec]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (selectedEventId) {
          setSelectedEventId(null);
          setNoteInput('');
        } else if (tourStep !== null) {
          setTourStep(null);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedEventId, tourStep]);

  const handleOpenModal = (evt) => {
    playTone('click');
    setActiveTab('console');
    setSelectedEventId(evt.id);
    setNoteInput(evt.note || '');
  };

  const handleReviewFromNotification = (evt) => {
    setQueueFilter('pending');
    handleOpenModal(evt);
    setTimeout(() => {
      const el = document.getElementById('tour-event-queue');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  };

  const handleResolveEvent = (newStatus) => {
    if (!selectedEvent || isResolving) return;
    setIsResolving(true);
    const cleanNote = sanitizeNote(noteInput, 160);
    const label = newStatus === 'BLOCKED' ? 1 : 0;

    const training = trainModelStep(model, selectedEvent, label, cleanNote);
    setModel(training.model);

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
      `[Aprendizaje sutil #${training.model.updatesCount}] ${newStatus === 'BLOCKED' ? 'Bloqueaste' : 'Aprobaste'} ${selectedEvent.id} (riesgo ${training.prevScore}% → ${training.newScore}%).`
    );
    playTone(newStatus === 'BLOCKED' ? 'block' : 'approve');
    setSelectedEventId(null);
    setNoteInput('');
    setTimeout(() => setIsResolving(false), 180);
  };

  const handleExport = (format) => {
    playTone('click');
    setExportOpen(false);
    const dateTag = new Date().toISOString().slice(0, 10);

    if (format === 'csv') {
      const header =
        'ID;Dificultad;Categoria;Operacion;ImporteEUR;Ubicacion;Riesgo%;Estado;Nota\n';
      const rows = events
        .map(
          (e) =>
            `${e.id};"${e.difficulty || 'Media'}";"${e.risk.threatCategory}";"${e.title}";${e.amount || 0};"${e.location}";${e.risk.score};${e.status};"${e.note || ''}"`
        )
        .join('\n');
      downloadFile(
        `\uFEFF${header}${rows}`,
        `sentinel-hitl-datos-${dateTag}.csv`,
        'text/csv;charset=utf-8'
      );
      return;
    }

    if (format === 'txt') {
      const summary = [
        `INFORME EJECUTIVO · SENTINEL HITL (${dateTag})`,
        `==================================================`,
        `Resueltas por IA: ${metrics.aiResolved} (Aprobadas 100% seguras: ${metrics.aiApproved} | Bloqueadas 100%: ${metrics.aiBlocked})`,
        `Resueltas por Humano: ${metrics.humanResolved}`,
        `Capital protegido: ${metrics.protectedCapital.toLocaleString('es-ES')} €`,
        `Ajustes de aprendizaje sutil: ${model.updatesCount}`,
        ``,
        `REGISTRO DE OPERACIONES:`,
        ...events.map(
          (e) =>
            `- [${e.status}] ${e.id} | ${e.title} (${e.location}) | Riesgo: ${e.risk.score}%${e.note ? ` | Nota: ${e.note}` : ''}`
        ),
      ].join('\n');
      downloadFile(
        summary,
        `sentinel-hitl-resumen-${dateTag}.txt`,
        'text/plain;charset=utf-8'
      );
      return;
    }

    const payload = {
      exportedAt: new Date().toISOString(),
      system: 'Sentinel HITL',
      model,
      metrics,
      events,
    };
    downloadFile(
      JSON.stringify(payload, null, 2),
      `sentinel-hitl-modelo-ml-${dateTag}.json`,
      'application/json'
    );
  };

  const handleDownloadManual = () => {
    playTone('click');
    const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"/><title>Manual 1 Hoja · Sentinel HITL</title>
<style>
  body{font-family:system-ui,-apple-system,sans-serif;color:#0f172a;max-width:820px;margin:24px auto;padding:28px;border:1px solid #cbd5e1;border-radius:14px;line-height:1.45}
  h1{margin:0 0 6px;color:#0a1628;font-size:24px} .sub{color:#475569;margin:0 0 18px;font-size:14px}
  h2{font-size:15px;color:#1d4ed8;border-bottom:1px solid #e2e8f0;padding-bottom:4px;margin:16px 0 8px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:14px} ul{margin:0;padding-left:18px;font-size:13px}
  .footer{margin-top:20px;padding-top:12px;border-top:2px solid #0a1628;display:flex;justify-content:space-between;font-size:13px}
  a{color:#1d4ed8;text-decoration:none;font-weight:700}
  @media print{body{border:none;margin:0;padding:12px}}
</style></head><body>
<h1>Sentinel HITL · Seguridad de Accesos y Antifraude</h1>
<p class="sub">Ficha Técnica y Manual Ejecutivo (1 Hoja) · Desarrollado por Roberto Di Giovanni Igartua</p>
<div class="grid">
  <div>
    <h2>1. Propósito del Proyecto</h2>
    <ul>
      <li>Consola bancaria reactiva con <strong>IA supervisada (Human-in-the-Loop)</strong>.</li>
      <li>Separación estricta: la IA solo aprueba automáticamente al <strong>100% de seguridad</strong> (auditable) y bloquea ataques al <strong>100% de certeza</strong>.</li>
      <li>Cualquier caso con riesgo intermedio (1%–99%) se escala al operador humano.</li>
    </ul>
  </div>
  <div>
    <h2>2. Motor ML Online (Regresión Logística)</h2>
    <ul>
      <li>Evalúa 6 señales en vivo (importe, país, horario, viaje imposible, dispositivo y fallos).</li>
      <li>Aprendizaje sutil (<code>lr=0.12</code>) con regularización L2 para evitar sesgos por errores humanos.</li>
      <li>Persistencia en <code>localStorage</code> y exportación en <code>.CSV</code>, <code>.TXT</code> y <code>.JSON</code>.</li>
    </ul>
  </div>
  <div>
    <h2>3. Defensa (HTTP 429) y Rendimiento (N+1)</h2>
    <ul>
      <li><strong>Rate Limiter:</strong> bloquea accesos tras 5 intentos fallidos en 60s devolviendo <code>HTTP 429</code>.</li>
      <li><strong>Benchmark real:</strong> genera 15.000 operaciones en memoria y compara patrón N+1 frente a agregación en <code>Map</code> (&gt;70% menos latencia).</li>
    </ul>
  </div>
  <div>
    <h2>4. Calidad e Ingeniería</h2>
    <ul>
      <li>Suite de 6 tests unitarios automatizados en <strong>Vitest</strong>.</li>
      <li>Flujo GitHub Flow, ESLint/Prettier, Dockerfile con Nginx y GitHub Actions.</li>
      <li>Guía interactiva Spotlight (7 pasos), modo claro/oscuro y Web Audio API nativa.</li>
    </ul>
  </div>
</div>
<div class="footer">
  <div><strong>Autor:</strong> Roberto Di Giovanni Igartua · Full Stack (React · FastAPI · SQL)</div>
  <div><a href="${LINKEDIN_URL}">LinkedIn</a> · <a href="${GITHUB_PROFILE_URL}">GitHub</a></div>
</div>
</body></html>`;
    downloadFile(html, 'Sentinel-HITL-Manual-1-Hoja.html', 'text/html;charset=utf-8');
  };

  const handleSimulateLogin = () => {
    const res = limiterRef.current.attempt();
    setLoginStatus({
      ...res,
      message: res.allowed
        ? `Acceso procesado (${res.attempts}/${res.maxAttempts} intentos en 60s)`
        : 'Bloqueo preventivo activado por fuerza bruta (HTTP 429)',
    });
    playTone(res.allowed ? 'click' : 'error429');
  };

  const handleResetLimiter = () => {
    playTone('click');
    limiterRef.current.reset();
    setLoginStatus({
      status: 200,
      attempts: 0,
      maxAttempts: 5,
      retryAfterSec: 0,
      message: 'Contador reiniciado. Puerta de acceso operativa.',
    });
  };

  const handleResetDemo = () => {
    playTone('click');
    const freshModel = createInitialModel();
    const freshEvents = INITIAL_SCENARIOS.map((s) =>
      buildEvaluatedEvent(s, freshModel)
    );
    try {
      localStorage.removeItem(STORAGE_MODEL_KEY);
      localStorage.removeItem(STORAGE_EVENTS_KEY);
    } catch {
      // Ignorar
    }
    setModel(freshModel);
    setEvents(freshEvents);
    setSelectedEventId(null);
    setNoteInput('');
    setAiLogs([
      'IA reiniciada a valores de fábrica. Tráfico en vivo listo.',
      'Solo aprueba automáticamente al 100% de seguridad (auditable por humano).',
    ]);
    handleResetLimiter();
  };

  const isSpot = (id) => currentTour?.id === id;
  const showNotifications =
    !currentTour && !selectedEvent && pendingEvents.length > 0;

  if (!entered) {
    return (
      <main className="welcome-wrap">
        <section className="welcome-card animate-in">
          <div className="welcome-hero">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '0.75rem',
                flexWrap: 'wrap',
              }}
            >
              <span className="pill-dark">
                <SentinelLogo size={18} /> Arquitectura Antifraude · IA
                Supervisada (HITL)
              </span>
              <button
                className="btn-ghost-dark"
                onClick={() => {
                  playTone('click');
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
              ingeniería Full Stack, Machine Learning online con control humano,
              defensa HTTP 429 y optimización real sobre 15.000 transacciones.
            </p>
            <div className="hero-specs mono">
              <span className="hero-spec-tag">LogReg Online + L2</span>
              <span className="hero-spec-tag">Rate Limiter HTTP 429</span>
              <span className="hero-spec-tag">Benchmark Real 15.000 ops</span>
              <span className="hero-spec-tag">Vitest TDD · 0€ Serverless</span>
            </div>
          </div>

          <div className="welcome-body">
            <div className="feature-grid">
              <article className="feature-box">
                <span className="step-num mono">01</span>
                <h3>IA Autónoma + Verificación</h3>
                <p>
                  La IA solo aprueba sola al 100% de seguridad (con bandeja de
                  auditoría humana) y bloquea ataques al 100%.
                </p>
              </article>
              <article className="feature-box">
                <span className="step-num mono">02</span>
                <h3>Escudo Antibots (429)</h3>
                <p>
                  Protección real de acceso de operadores frente a fuerza bruta
                  con bloqueo automático y cuenta atrás.
                </p>
              </article>
              <article className="feature-box">
                <span className="step-num mono">03</span>
                <h3>Rendimiento Real N+1</h3>
                <p>
                  Cronometra en tu propio procesador 15.000 operaciones reales y
                  comprueba la reducción de latencia.
                </p>
              </article>
            </div>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                gap: '0.85rem',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
                <button
                  className="btn-primary"
                  onClick={() => {
                    playTone('approve');
                    setEntered(true);
                    setTourStep(0);
                  }}
                  style={{ padding: '0.92rem 1.75rem', fontSize: '0.98rem' }}
                >
                  Iniciar visita guiada (7 pasos) →
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => {
                    playTone('click');
                    setEntered(true);
                    setTourStep(null);
                  }}
                  style={{ padding: '0.92rem 1.3rem', fontSize: '0.92rem' }}
                >
                  Entrar directamente
                </button>
              </div>
              <span
                className="mono"
                style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}
              >
                Sin registro · Roberto Di Giovanni Igartua
              </span>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <>
      {currentTour && <div className="tour-dimmer" aria-hidden="true" />}

      <header
        id="tour-topbar-actions"
        className="topbar-wrap"
        style={
          isSpot('topbar-actions')
            ? {
                zIndex: 60,
                boxShadow:
                  '0 0 0 4px #38bdf8, 0 12px 32px rgba(2, 132, 199, 0.5)',
              }
            : undefined
        }
      >
        <div className="topbar">
          <div className="brand">
            <span className="brand-icon">
              <SentinelLogo size={28} />
            </span>
            <div>
              <h1>Sentinel HITL</h1>
              <span className="brand-sub mono">
                <span
                  className={`live-dot ${metrics.threatLevel === 'ELEVADO' ? 'danger' : ''}`}
                />
                {aiScanning
                  ? 'IA ANALIZANDO OPERACIÓN...'
                  : autoStream
                    ? `EN VIVO · IA: ${metrics.aiResolved} | Humano: ${metrics.humanResolved}`
                    : 'TRÁFICO EN PAUSA'}
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

            <div className="export-wrap">
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
                    <span>Dataset Excel</span>
                    <span className="mono" style={{ fontSize: '0.72rem' }}>
                      .CSV
                    </span>
                  </button>
                  <button
                    className="export-item"
                    onClick={() => handleExport('txt')}
                  >
                    <span>Informe ejecutivo</span>
                    <span className="mono" style={{ fontSize: '0.72rem' }}>
                      .TXT
                    </span>
                  </button>
                  <button
                    className="export-item"
                    onClick={() => handleExport('json')}
                  >
                    <span>Pesos y auditoría ML</span>
                    <span className="mono" style={{ fontSize: '0.72rem' }}>
                      .JSON
                    </span>
                  </button>
                </div>
              )}
            </div>

            <span className="topbar-divider" />

            <button
              className="btn-ghost-dark"
              onClick={() => {
                playTone('click');
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
                setTourStep(null);
                setEntered(false);
              }}
            >
              Portada
            </button>
          </div>
        </div>
      </header>

      <div className="app-shell">
        <section
          id="tour-kpis"
          className={`kpi-grid ${isSpot('kpis') ? 'tour-spotlight' : ''}`}
          aria-label="Métricas principales"
        >
          <div className="card kpi-card">
            <div className="kpi-label">Pendientes (HITL)</div>
            <div className="kpi-value mono">{metrics.pending}</div>
            <div className="kpi-sub">Esperando decisión humana</div>
          </div>
          <div className="card kpi-card">
            <div className="kpi-label">Resueltas por IA</div>
            <div className="kpi-value mono" style={{ color: 'var(--accent)' }}>
              {metrics.aiResolved}
            </div>
            <div className="kpi-sub">
              {metrics.aiApproved} seguras · {metrics.aiBlocked} bloqueadas
            </div>
          </div>
          <div className="card kpi-card">
            <div className="kpi-label">Resueltas por Humano</div>
            <div className="kpi-value mono">{metrics.humanResolved}</div>
            <div className="kpi-sub">Auditoría y entrenamiento</div>
          </div>
          <div className="card kpi-card">
            <div className="kpi-label">Capital protegido</div>
            <div className="kpi-value mono" style={{ color: 'var(--success)' }}>
              {metrics.protectedCapital.toLocaleString('es-ES')} €
            </div>
            <div className="kpi-sub">Amenaza: {metrics.threatLevel}</div>
          </div>
        </section>

        <nav className="tabs" aria-label="Secciones principales">
          <button
            className={`tab-btn ${activeTab === 'console' ? 'active' : ''}`}
            onClick={() => {
              playTone('click');
              setActiveTab('console');
            }}
          >
            1. Supervisión IA ({metrics.pending})
          </button>
          <button
            className={`tab-btn ${activeTab === 'lab' ? 'active' : ''}`}
            onClick={() => {
              playTone('click');
              setActiveTab('lab');
            }}
          >
            2. Defensa y Rendimiento
          </button>
          <button
            className={`tab-btn ${activeTab === 'quality' ? 'active' : ''}`}
            onClick={() => {
              playTone('click');
              setActiveTab('quality');
            }}
          >
            3. Ingeniería y Autor
          </button>
        </nav>

        {activeTab === 'console' && (
          <section className="animate-in">
            <div className="section-intro">
              <h2>Supervisión de Inteligencia Artificial (HITL)</h2>
              <p>
                La IA solo aprueba sola al 100% de seguridad (verificable por
                ti) y bloquea ataques al 100%. Todo lo demás pasa a tu control.
              </p>
            </div>

            <div
              id="tour-ai-monitor"
              className={`ai-monitor ${isSpot('ai-monitor') ? 'tour-spotlight' : ''}`}
            >
              <div className={`ai-scan-bar ${aiScanning ? 'fast' : ''}`} />
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '0.6rem',
                  flexWrap: 'wrap',
                }}
              >
                <strong
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    fontSize: '0.96rem',
                    color: '#7dd3fc',
                  }}
                >
                  <CpuIcon /> Cerebro Sentinel AI · Cómo evalúa el riesgo en
                  vivo
                </strong>
                <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                  <button
                    className="btn-ghost-dark"
                    style={{ padding: '0.32rem 0.68rem', fontSize: '0.75rem' }}
                    onClick={() => {
                      playTone('click');
                      setAutoStream((s) => !s);
                    }}
                  >
                    {autoStream ? 'Pausar flujo' : 'Reanudar flujo'}
                  </button>
                  <button
                    className="btn-guide-cta"
                    style={{ padding: '0.32rem 0.72rem', fontSize: '0.75rem' }}
                    onClick={() => processIncomingOperation(true)}
                    disabled={aiScanning}
                  >
                    + Generar caso complejo
                  </button>
                </div>
              </div>

              <div className="ai-rules-grid">
                <div className="ai-rule-pill">
                  <strong style={{ color: '#34d399' }}>
                    0% Riesgo (100% Segura)
                  </strong>
                  Aprobación automática + bandeja de verificación humana.
                </div>
                <div className="ai-rule-pill">
                  <strong style={{ color: '#fbbf24' }}>
                    1% – 99% · Zona de duda
                  </strong>
                  Escalado obligatorio al humano + aprendizaje sutil.
                </div>
                <div className="ai-rule-pill">
                  <strong style={{ color: '#f87171' }}>
                    100% · Certeza de ataque
                  </strong>
                  Bloqueo automático inmediato y registro auditable.
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.76rem',
                  color: '#94a3b8',
                  marginBottom: '0.5rem',
                  flexWrap: 'wrap',
                  gap: '0.4rem',
                }}
              >
                <span>
                  <strong>Sensibilidad aprendida por señal</strong> (tasa sutil
                  lr={model.learningRate}, anti-sesgo):
                </span>
                <span className="mono">
                  AJUSTES HUMANOS: {model.updatesCount}
                </span>
              </div>

              <div className="ai-weights-grid">
                {Object.entries(model.weights).map(([key, val]) => {
                  const pct = Math.min(
                    100,
                    Math.max(10, Math.round((val / 4) * 100))
                  );
                  const levelText =
                    val >= 2.2 ? 'Alta' : val >= 1.4 ? 'Media' : 'Baja';
                  const barColor =
                    val >= 2.2 ? '#f87171' : val >= 1.4 ? '#38bdf8' : '#34d399';
                  return (
                    <div
                      key={key}
                      className="ai-weight-box"
                      title={`Peso matemático real w=${val.toFixed(2)}`}
                    >
                      <div className="ai-weight-head">
                        <span>{FEATURE_META[key]?.short || key}</span>
                        <strong className="mono" style={{ color: barColor }}>
                          {levelText} ({val.toFixed(2)})
                        </strong>
                      </div>
                      <div className="ai-weight-track">
                        <div
                          className="ai-weight-fill"
                          style={{ width: `${pct}%`, backgroundColor: barColor }}
                        />
                      </div>
                    </div>
                  );
                })}
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

            <div className="section-head">
              <h3>Panel de cola y verificación</h3>
            </div>

            <div className="subtabs">
              <button
                className={`subtab-btn ${queueFilter === 'pending' ? 'active' : ''}`}
                onClick={() => {
                  playTone('click');
                  setQueueFilter('pending');
                }}
              >
                Pendientes HITL ({pendingEvents.length})
              </button>
              <button
                className={`subtab-btn ${queueFilter === 'ai_verify' ? 'active' : ''}`}
                onClick={() => {
                  playTone('click');
                  setQueueFilter('ai_verify');
                }}
              >
                Verificar IA · 100% Seguras ({aiVerifyEvents.length})
              </button>
              <button
                className={`subtab-btn ${queueFilter === 'history' ? 'active' : ''}`}
                onClick={() => {
                  playTone('click');
                  setQueueFilter('history');
                }}
              >
                Historial y Bloqueos ({historyEvents.length})
              </button>
            </div>

            <div
              id="tour-event-queue"
              className={`event-list ${isSpot('event-queue') ? 'tour-spotlight' : ''}`}
            >
              {visibleEvents.length === 0 ? (
                <div className="card" style={{ textAlign: 'center' }}>
                  <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                    No hay operaciones en esta vista. El flujo en vivo genera
                    nuevos casos automáticamente cada pocos segundos.
                  </p>
                </div>
              ) : (
                visibleEvents.map((evt) => (
                  <article
                    key={evt.id}
                    className={`event-item animate-in ${
                      evt.status !== 'PENDING'
                        ? 'is-resolved'
                        : evt.risk.level === 'CRÍTICO'
                          ? 'is-critical'
                          : ''
                    }`}
                  >
                    <div style={{ flex: '1 1 280px' }}>
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '0.45rem',
                          alignItems: 'center',
                          marginBottom: '0.4rem',
                        }}
                      >
                        <span className="mono" style={{ fontSize: '0.78rem' }}>
                          {evt.id}
                        </span>
                        <span
                          className={`badge ${
                            evt.risk.score === 0
                              ? 'badge-ok'
                              : evt.risk.level === 'CRÍTICO'
                                ? 'badge-critical'
                                : 'badge-high'
                          }`}
                        >
                          Riesgo: {evt.risk.score}%
                        </span>
                        <span className="badge badge-ai">
                          {evt.risk.threatCategory}
                        </span>
                        <span className="badge badge-neutral">
                          Nivel: {evt.difficulty || 'Media'}
                        </span>
                        {evt.status !== 'PENDING' && (
                          <span
                            className={`badge ${
                              evt.status === 'BLOCKED' ||
                              evt.status === 'AUTO_BLOCKED'
                                ? 'badge-critical'
                                : 'badge-ok'
                            }`}
                          >
                            {evt.status === 'AUTO_APPROVED'
                              ? 'APROBADA IA (100%)'
                              : evt.status === 'AUTO_BLOCKED'
                                ? 'BLOQUEADA IA (100%)'
                                : evt.status === 'BLOCKED'
                                  ? 'BLOQUEADA HUMANO'
                                  : 'APROBADA HUMANO'}
                          </span>
                        )}
                      </div>
                      <strong style={{ display: 'block', fontSize: '0.98rem' }}>
                        {evt.title}
                        {evt.amount > 0
                          ? ` · ${evt.amount.toLocaleString('es-ES')} €`
                          : ''}
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
                      <div
                        style={{
                          fontSize: '0.82rem',
                          color: 'var(--accent)',
                          marginTop: '0.3rem',
                          fontWeight: 600,
                        }}
                      >
                        Consejo IA: {evt.risk.actionAdvice}
                      </div>
                      {evt.note && (
                        <div
                          style={{
                            fontSize: '0.82rem',
                            marginTop: '0.25rem',
                            color: 'var(--text)',
                          }}
                        >
                          Registro: <em>{evt.note}</em>
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
                          ? 'Revisar'
                          : evt.status === 'AUTO_APPROVED'
                            ? 'Verificar / Corregir'
                            : 'Auditar'}
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        )}

        {activeTab === 'lab' && (
          <section className="animate-in">
            <div className="section-intro">
              <h2>Infraestructura: Escudo Antibots y Rendimiento Real</h2>
              <p>
                Los dos pilares técnicos que protegen el acceso a Sentinel HITL
                y garantizan respuestas instantáneas sobre miles de operaciones.
              </p>
            </div>

            <div className="lab-grid">
              <article
                id="tour-lab-429"
                className={`card ${isSpot('lab-429') ? 'tour-spotlight' : ''}`}
              >
                <span className="badge badge-critical">
                  Escudo de Acceso (/api/auth/login)
                </span>
                <h3
                  style={{ margin: '0.65rem 0 0.35rem', fontSize: '1.08rem' }}
                >
                  Protección antibots con HTTP 429
                </h3>
                <p
                  style={{
                    margin: '0 0 1.1rem',
                    fontSize: '0.86rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  Protege la consola de operadores frente a ataques de fuerza
                  bruta. Tras 5 intentos en 60 segundos, bloquea el origen y
                  devuelve <span className="mono">HTTP 429</span>.
                </p>

                <div
                  style={{
                    padding: '0.9rem',
                    borderRadius: 10,
                    background:
                      loginStatus.status === 429
                        ? 'var(--danger-bg)'
                        : 'var(--surface-muted)',
                    border: '1px solid var(--border)',
                    marginBottom: '1.1rem',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <strong className="mono">
                      Estado HTTP {loginStatus.status}
                    </strong>
                    <span className="mono" style={{ fontSize: '0.82rem' }}>
                      {loginStatus.attempts}/{loginStatus.maxAttempts} intentos
                    </span>
                  </div>
                  <p style={{ margin: '0.45rem 0 0', fontSize: '0.85rem' }}>
                    {loginStatus.message}
                  </p>
                  {loginStatus.retryAfterSec > 0 && (
                    <div
                      className="mono"
                      style={{
                        marginTop: '0.5rem',
                        fontSize: '0.85rem',
                        color: '#ef4444',
                        fontWeight: 700,
                      }}
                    >
                      Bloqueo activo · Reintento en: {loginStatus.retryAfterSec}
                      s
                    </div>
                  )}
                </div>

                <div
                  style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap' }}
                >
                  <button
                    className="btn-danger"
                    onClick={handleSimulateLogin}
                    disabled={loginStatus.status === 429}
                  >
                    Simular intento de acceso
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={handleResetLimiter}
                  >
                    Reiniciar ventana
                  </button>
                </div>
              </article>

              <article
                id="tour-lab-n1"
                className={`card ${isSpot('lab-n1') ? 'tour-spotlight' : ''}`}
              >
                <span className="badge badge-ok">
                  Medición Real CPU (-{benchmark.reductionPct}% tiempo)
                </span>
                <h3
                  style={{ margin: '0.65rem 0 0.35rem', fontSize: '1.08rem' }}
                >
                  Agregación real de{' '}
                  {benchmark.datasetSize.toLocaleString('es-ES')} operaciones
                </h3>
                <p
                  style={{
                    margin: '0 0 0.85rem',
                    fontSize: '0.86rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  Genera 15.000 transacciones reales en memoria (volumen total:{' '}
                  <strong className="mono">
                    {benchmark.totalVolumeEur.toLocaleString('es-ES')} €
                  </strong>
                  ) y cronometra con <span className="mono">performance.now()</span>{' '}
                  el patrón lento N+1 frente a 1 pasada indexada.
                </p>

                <div
                  style={{
                    display: 'flex',
                    gap: '0.5rem',
                    marginBottom: '1.1rem',
                    flexWrap: 'wrap',
                  }}
                >
                  {[20, 40, 80].map((n) => (
                    <button
                      key={n}
                      className={
                        clientCount === n ? 'btn-primary' : 'btn-secondary'
                      }
                      onClick={() => {
                        playTone('click');
                        setClientCount(n);
                      }}
                    >
                      {n} clientes
                    </button>
                  ))}
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      playTone('click');
                      setBenchRunId((id) => id + 1);
                    }}
                  >
                    Ejecutar medición real
                  </button>
                </div>

                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '0.85rem',
                    }}
                  >
                    <span>
                      Patrón lento N+1 ({benchmark.nPlusOne.queries} barridos)
                    </span>
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
                      fontSize: '0.85rem',
                    }}
                  >
                    <span>
                      Agregación indexada ({benchmark.aggregated.queries}{' '}
                      pasada)
                    </span>
                    <strong
                      className="mono"
                      style={{ color: 'var(--success)' }}
                    >
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
              </article>
            </div>
          </section>
        )}

        {activeTab === 'quality' && (
          <section className="animate-in">
            <div className="section-intro">
              <h2>Ingeniería Aplicada y Autoría</h2>
              <p>
                Resumen actualizado del desarrollo, manual ejecutivo de 1 hoja y
                perfiles profesionales.
              </p>
            </div>

            <div
              id="tour-quality-author"
              className={`lab-grid ${isSpot('quality-author') ? 'tour-spotlight' : ''}`}
            >
              <article className="card">
                <span className="badge badge-ok">Arquitectura verificada</span>
                <h3 style={{ margin: '0.65rem 0 0.6rem', fontSize: '1.08rem' }}>
                  Desarrollo y propósito de Sentinel HITL
                </h3>
                <ul
                  style={{
                    margin: '0 0 1.2rem',
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
                      ML Online con seguridad estricta:
                    </strong>{' '}
                    Solo aprueba sola al 100% de seguridad (con bandeja de
                    verificación humana) y aprende sutilmente con regularización
                    L2.
                  </li>
                  <li>
                    <strong style={{ color: 'var(--text)' }}>
                      Pruebas TDD (Vitest):
                    </strong>{' '}
                    Suite automatizada que valida saneado anti-XSS, aprendizaje
                    del modelo, Rate Limiter HTTP 429 y agregación real de
                    15.000 registros.
                  </li>
                  <li>
                    <strong style={{ color: 'var(--text)' }}>
                      Auditoría y Persistencia:
                    </strong>{' '}
                    Memoria local en navegador y exportación en Excel (CSV),
                    Resumen (TXT) y Modelo ML (JSON).
                  </li>
                </ul>
                <button className="btn-primary" onClick={handleDownloadManual}>
                  Descargar Manual del Proyecto (1 hoja) ↓
                </button>
              </article>

              <article className="card">
                <span className="pill">Autor del proyecto</span>
                <h3
                  style={{ margin: '0.65rem 0 0.4rem', fontSize: '1.08rem' }}
                >
                  Roberto Di Giovanni Igartua
                </h3>
                <p
                  style={{
                    margin: '0 0 1.25rem',
                    fontSize: '0.88rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  Desarrollador Full Stack (React · FastAPI · SQL) enfocado en
                  seguridad, sistemas con IA supervisada (HITL) y calidad de
                  software.
                </p>
                <div
                  style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}
                >
                  <a
                    href={LINKEDIN_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-link btn-primary"
                  >
                    LinkedIn ↗
                  </a>
                  <a
                    href={GITHUB_PROFILE_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-link btn-secondary"
                  >
                    Perfil GitHub ↗
                  </a>
                </div>
              </article>
            </div>
          </section>
        )}

        {/* Guía Spotlight */}
        {currentTour && (
          <aside
            className="tour-card animate-in"
            role="dialog"
            aria-label="Guía interactiva"
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <span className="tour-step-badge mono">
                Guía interactiva · Paso {tourStep + 1} de {TOUR_STEPS.length}
              </span>
              <button
                className="tour-close-btn"
                onClick={() => {
                  playTone('click');
                  setTourStep(null);
                }}
              >
                Cerrar guía
              </button>
            </div>

            <div className="tour-progress-track">
              <div
                className="tour-progress-fill"
                style={{
                  width: `${Math.round(((tourStep + 1) / TOUR_STEPS.length) * 100)}%`,
                }}
              />
            </div>

            <h3 style={{ margin: '0 0 0.55rem', fontSize: '1.15rem' }}>
              {currentTour.title}
            </h3>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem',
                fontSize: '0.88rem',
                color: 'var(--text-muted)',
                marginBottom: '1.1rem',
              }}
            >
              <div>
                <strong style={{ color: 'var(--text)' }}>Qué es:</strong>{' '}
                {currentTour.what}
              </div>
              <div>
                <strong style={{ color: 'var(--text)' }}>Para qué sirve:</strong>{' '}
                {currentTour.why}
              </div>
              <div>
                <strong style={{ color: 'var(--primary)' }}>
                  Cómo probarlo:
                </strong>{' '}
                {currentTour.how}
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <button
                className="btn-secondary"
                disabled={tourStep === 0}
                onClick={() => {
                  playTone('click');
                  setTourStep((s) => Math.max(0, s - 1));
                }}
              >
                ← Anterior
              </button>
              {tourStep < TOUR_STEPS.length - 1 ? (
                <button
                  className="btn-primary"
                  onClick={() => {
                    playTone('click');
                    setTourStep((s) => s + 1);
                  }}
                >
                  Continuar (Paso {tourStep + 2} de {TOUR_STEPS.length}) →
                </button>
              ) : (
                <button
                  className="btn-success"
                  onClick={() => {
                    playTone('approve');
                    setTourStep(null);
                  }}
                >
                  Finalizar guía ✓
                </button>
              )}
            </div>
          </aside>
        )}

        {/* Notificaciones persistentes */}
        {showNotifications && (
          <aside className="toast-stack" aria-live="polite">
            {pendingEvents.length > 3 ? (
              <div className="toast-card animate-in">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.4rem',
                  }}
                >
                  <span className="badge badge-critical">
                    {pendingEvents.length} amenazas pendientes
                  </span>
                  <span
                    className="mono"
                    style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}
                  >
                    HITL activo
                  </span>
                </div>
                <strong
                  style={{
                    display: 'block',
                    fontSize: '0.9rem',
                    marginBottom: '0.25rem',
                  }}
                >
                  Tienes {pendingEvents.length} alertas esperando tu decisión
                </strong>
                <div
                  style={{
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)',
                    marginBottom: '0.7rem',
                  }}
                >
                  La IA necesita tu autorización en la cola para resolverlas y
                  seguir aprendiendo.
                </div>
                <button
                  className="btn-primary"
                  style={{ width: '100%', padding: '0.52rem' }}
                  onClick={() => handleReviewFromNotification(pendingEvents[0])}
                >
                  Revisar en la cola (1 a 1) →
                </button>
              </div>
            ) : (
              pendingEvents.map((t) => (
                <div key={t.id} className="toast-card animate-in">
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '0.3rem',
                    }}
                  >
                    <span className="badge badge-critical">
                      Riesgo IA · {t.risk.score}%
                    </span>
                    <span
                      className="mono"
                      style={{
                        fontSize: '0.72rem',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {t.id}
                    </span>
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
                    {t.risk.threatCategory} · {t.location}
                  </div>
                  <button
                    className="btn-primary"
                    style={{ width: '100%', padding: '0.45rem' }}
                    onClick={() => handleReviewFromNotification(t)}
                  >
                    Revisar ahora
                  </button>
                </div>
              ))
            )}
          </aside>
        )}

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
            <div
              className="modal-panel animate-in"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.65rem',
                }}
              >
                <span className="badge badge-critical">
                  Riesgo {selectedEvent.risk.score}% · Seguridad{' '}
                  {selectedEvent.risk.safetyPct}%
                </span>
                <span className="mono" style={{ fontSize: '0.8rem' }}>
                  {selectedEvent.id} · {selectedEvent.difficulty || 'Media'}
                </span>
              </div>

              <h3 style={{ margin: '0 0 0.3rem', fontSize: '1.14rem' }}>
                {selectedEvent.title}
                {selectedEvent.amount > 0
                  ? ` (${selectedEvent.amount.toLocaleString('es-ES')} €)`
                  : ''}
              </h3>
              <p
                style={{
                  margin: '0 0 0.85rem',
                  fontSize: '0.86rem',
                  color: 'var(--text-muted)',
                }}
              >
                {selectedEvent.account} · {selectedEvent.location} ·{' '}
                {selectedEvent.timestamp}
              </p>

              <div className="modal-ai-box">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.5rem',
                    flexWrap: 'wrap',
                    marginBottom: '0.5rem',
                  }}
                >
                  <strong style={{ color: '#7dd3fc' }}>
                    {selectedEvent.risk.threatCategory}
                  </strong>
                  <span
                    className="mono"
                    style={{ fontSize: '0.75rem', color: '#fca5a5' }}
                  >
                    {selectedEvent.risk.actionAdvice}
                  </span>
                </div>
                <ul
                  style={{ margin: 0, paddingLeft: '1.1rem', color: '#cbd5e1' }}
                >
                  {selectedEvent.risk.contributions.length > 0 ? (
                    selectedEvent.risk.contributions.map((c) => (
                      <li key={c.key}>
                        <strong>{c.label}</strong> (influye{' '}
                        {c.impact >= 1.5
                          ? 'mucho'
                          : c.impact >= 0.8
                            ? 'bastante'
                            : 'moderadamente'}{' '}
                        en el riesgo)
                      </li>
                    ))
                  ) : (
                    <li>Sin factores de riesgo detectados (100% segura).</li>
                  )}
                </ul>
              </div>

              <label
                htmlFor="hitl-note"
                style={{
                  display: 'block',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                }}
              >
                Nota de auditoría (opcional, ayuda a calibrar la IA)
              </label>
              <textarea
                id="hitl-note"
                className="modal-textarea"
                maxLength={160}
                placeholder="Ej.: Cliente confirmado por teléfono; falso positivo."
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
              />
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  marginBottom: '1rem',
                }}
              >
                <span>Aprendizaje sutil con protección anti-sesgo.</span>
                <span className="mono">{noteInput.length}/160</span>
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
                  Bloquear amenaza
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}