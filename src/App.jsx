import { useEffect, useMemo, useRef, useState } from 'react';
import {
  computeDashboardMetrics,
  computeSha256Hex,
  createIdempotencyGuard,
  createInitialModel,
  createRateLimiter,
  escapeCsvCell,
  evaluateRiskEvent,
  runQueryBenchmark,
  sanitizeNote,
  trainModelStep,
} from './engine/securityEngine';

const STORAGE_SESSION_KEY = 'sentinel_hitl_session_v5';
const STORAGE_THEME_KEY = 'sentinel_hitl_theme_v1';
const NOTIF_SNOOZE_MS = 5 * 60 * 1000; // 5 minutos

const GITHUB_PROFILE_URL = 'https://github.com/cpudiroberto';
const LINKEDIN_URL =
  'https://www.linkedin.com/in/roberto-di-giovanni-igartua-718338209/';

/**
 * Logotipo único ultranítido (idéntico al favicon de index.html y a la portada/cabecera)
 */
const SentinelBrandIcon = ({ size = 32, paused = false }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="sentinelGrad" x1="8" y1="4" x2="56" y2="60" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#38bdf8" />
        <stop offset="0.55" stopColor="#2563eb" />
        <stop offset="1" stopColor="#0b1f4a" />
      </linearGradient>
    </defs>
    <path
      d="M32 4L55 13V30.5C55 44.8 45.2 55.8 32 60C18.8 55.8 9 44.8 9 30.5V13L32 4Z"
      fill="url(#sentinelGrad)"
      stroke="#e0f2fe"
      strokeWidth="3"
    />
    <path
      d="M32 13L46 18.8V30.2C46 39.2 40 46.4 32 49.4C24 46.4 18 39.2 18 30.2V18.8L32 13Z"
      fill="#071224"
      fillOpacity="0.55"
      stroke="#7dd3fc"
      strokeWidth="2"
    />
    {paused ? (
      <>
        <rect x="25" y="23" width="5" height="16" rx="1.5" fill="#f8fafc" />
        <rect x="34" y="23" width="5" height="16" rx="1.5" fill="#f8fafc" />
      </>
    ) : (
      <circle cx="32" cy="31" r="6.5" fill="#38bdf8" />
    )}
  </svg>
);

const BackgroundCrystalWaves = () => (
  <div className="bg-crystal-stage" aria-hidden="true">
    <svg className="bg-wave-svg" viewBox="0 0 1440 900" preserveAspectRatio="none">
      <defs>
        <linearGradient id="waveGlass1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--wave-a)" />
          <stop offset="55%" stopColor="var(--wave-b)" />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
      </defs>
      <path
        fill="url(#waveGlass1)"
        d="M0,180 C280,80 560,310 880,190 C1160,85 1320,210 1440,140 L1440,560 C1180,660 880,440 540,560 C260,660 120,520 0,600 Z"
      />
    </svg>
    <svg className="bg-wave-svg-2" viewBox="0 0 1440 900" preserveAspectRatio="none">
      <defs>
        <linearGradient id="waveGlass2" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="var(--wave-b)" />
          <stop offset="60%" stopColor="var(--wave-a)" />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
      </defs>
      <path
        fill="url(#waveGlass2)"
        d="M0,480 C340,360 660,640 1020,480 C1240,380 1360,460 1440,420 L1440,900 L0,900 Z"
      />
    </svg>
  </div>
);

const TOUR_STEPS = [
  {
    id: 'kpis',
    tab: 'console',
    title: 'Panel de Mando Anclado (KPIs en Vivo)',
    body: 'Tus 4 indicadores clave permanecen visibles arriba al hacer scroll: tus casos pendientes, las operaciones 100% seguras aprobadas por IA, las resueltas en total y el capital protegido con estado dinámico según la exposición actual.',
  },
  {
    id: 'ai-monitor',
    tab: 'console',
    title: 'Cerebro Sentinel AI y Normativa Legal de España',
    body: 'Ofrece feedback en directo y cruza cada alerta con las directrices españolas (PSD2, Ley 10/2010 SEPBLAC, RGPD y Banco de España), destacando posibles vacíos legales para que decidas con respaldo normativo.',
  },
  {
    id: 'event-queue',
    tab: 'console',
    title: 'Doble Columna: Control Humano y Verificación IA',
    body: 'A la izquierda gestionas tus casos pendientes (con agrupación automática si varios proceden del mismo origen). A la derecha puedes auditar en cualquier momento las tarjetas contraídas aprobadas al 100% por la IA.',
  },
  {
    id: 'lab-429',
    tab: 'lab',
    title: 'Escudo HTTP 429 y Seguridad Verificable en F12',
    body: 'Esta sección reúne 6 capacidades técnicas ejecutables en directo (HTTP 429, Benchmark real de 15.000 ops, Anti-XSS, Firma SHA-256, Anti-CSRF/Idempotencia y Auditoría CSP). Cada prueba registra trazas reales en la consola F12.',
  },
  {
    id: 'lab-n1',
    tab: 'lab',
    title: 'Agregación Real de 15.000 Operaciones en RAM',
    body: 'Crea 15.000 transacciones reales en memoria, enseña una muestra verificable y mide con performance.now() cuántas iteraciones y milisegundos ahorra la agregación indexada frente al patrón N+1.',
  },
  {
    id: 'quality-author',
    tab: 'quality',
    title: 'Ingeniería, Documentación Completa y Autoría',
    body: 'Resumen transparente de la arquitectura real, descarga del documento técnico completo (listo para imprimir en PDF) y enlaces directos a LinkedIn y GitHub de Roberto Di Giovanni.',
  },
  {
    id: 'topbar-actions',
    tab: 'quality',
    title: 'Escudo 4D Interactivo, IA ON/OFF y Exportación',
    body: 'Pulsa el escudo para pausar o reanudar el tráfico; usa IA: ON/OFF para derivar todo directamente al humano; cambia entre modo Claro (antideslumbrante) y Oscuro, o descarga tus datos desde «Exportar ▾».',
  },
];

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
  { type: 'FINANCIAL', difficulty: 'Crítica', title: 'Transferencia urgente a cuenta offshore', account: 'ES77 •••• 6510 (Tesorería)', amount: 7500, foreignCountry: true, unusualHour: true, impossibleTravel: true, unknownDevice: true, failedAttempts: 5, location: 'Islas Caimán (KY)' },
  { type: 'ACCESS', difficulty: 'Crítica', title: 'Secuestro de cuenta admin con viaje imposible', account: 'root.finanzas@empresa.es', amount: 0, foreignCountry: true, unusualHour: true, impossibleTravel: true, unknownDevice: true, failedAttempts: 6, location: 'Madrid → Tokio (8 min)' },
  { type: 'FINANCIAL', difficulty: 'Crítica', title: 'Retirada urgente tras fuerza bruta confirmada', account: 'ES44 •••• 1093 (Operativa)', amount: 5200, foreignCountry: true, unusualHour: true, impossibleTravel: false, unknownDevice: true, failedAttempts: 4, location: 'Dubái (AE)' },
];

function generateRandomEvent(model, seq, forceRisky = false) {
  const pool = forceRisky
    ? CASE_TEMPLATES.filter((t) => t.difficulty !== 'Básica')
    : CASE_TEMPLATES;
  const tpl = pool[Math.floor(Math.random() * pool.length)];
  const jitter = tpl.amount > 0 ? Math.round((Math.random() - 0.5) * 260) : 0;
  const now = new Date();
  const timeStr = now.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const raw = {
    ...tpl,
    id: `EVT-${seq}`,
    amount: Math.max(0, (tpl.amount || 0) + jitter),
    timestamp: timeStr,
  };
  const risk = evaluateRiskEvent(raw, model);
  return { ...raw, risk, status: 'PENDING', note: '' };
}

function createFreshSession() {
  const model = createInitialModel();
  const baseSeq = 1000 + Math.floor(Math.random() * 8000);
  const e1 = generateRandomEvent(model, baseSeq, true);
  const e2 = generateRandomEvent(model, baseSeq + 1, true);
  const e3 = generateRandomEvent(model, baseSeq + 2, false);
  if (e3.risk.score === 0) {
    e3.status = 'AUTO_APPROVED';
    e3.note = 'Aprobada por IA (100% segura). Pendiente de verificación humana.';
  }
  return {
    entered: false,
    activeTab: 'console',
    aiEnabled: true,
    autoStream: true,
    seq: baseSeq + 3,
    model,
    events: [e1, e2, e3],
  };
}

function loadSession() {
  try {
    const raw = localStorage.getItem(STORAGE_SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        parsed.model &&
        typeof parsed.model.bias === 'number' &&
        parsed.model.weights &&
        Array.isArray(parsed.events)
      ) {
        return parsed;
      }
    }
  } catch {
    // Recuperación segura ante manipulación o JSON corrupto
  }
  return createFreshSession();
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
  const initial = useMemo(() => loadSession(), []);

  const [entered, setEntered] = useState(initial.entered);
  const [activeTab, setActiveTab] = useState(initial.activeTab);
  const [aiEnabled, setAiEnabled] = useState(initial.aiEnabled);
  const [autoStream, setAutoStream] = useState(initial.autoStream);
  const [model, setModel] = useState(initial.model);
  const [events, setEvents] = useState(initial.events);
  const seqRef = useRef(initial.seq || 9100);

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

  const [aiLogs, setAiLogs] = useState([
    'Normativa España sincronizada: PSD2, Ley 10/2010 (SEPBLAC), RGPD y Banco de España.',
    'Regla activa: la IA solo aprueba automáticamente casos 100% seguros; el resto pasa a ti.',
  ]);

  // --- Laboratorio 3: Anti-XSS ---
  const [xssInput, setXssInput] = useState(
    '<script>alert("Robo de sesión")</script> Transferencia verificada'
  );

  // --- Laboratorio 4: Sello Criptográfico SHA-256 (Web Crypto API) ---
  const [cryptoPayload, setCryptoPayload] = useState(
    'EVT-9041 | ES91-4821 | 3400 EUR | BLOCKED'
  );
  const [sealedHash, setSealedHash] = useState('');
  const [currentHash, setCurrentHash] = useState('');

  // --- Laboratorio 5: Anti-CSRF + Idempotencia (409 Conflict) ---
  const idempGuardRef = useRef(createIdempotencyGuard());
  const [activeIdempKey, setActiveIdempKey] = useState(() =>
    idempGuardRef.current.generateKey()
  );
  const [idempLog, setIdempLog] = useState([
    'Listo para probar doble envío con la misma clave de idempotencia.',
  ]);

  // --- Laboratorio 6: Auditoría en vivo de Seguridad del Navegador ---
  const [auditChecks, setAuditChecks] = useState(null);

  // Desbloqueo seguro de AudioContext (CERO warnings de Autoplay en F12)
  const audioCtxRef = useRef(null);
  const audioUnlockedRef = useRef(false);

  useEffect(() => {
    const unlockAudio = () => {
      audioUnlockedRef.current = true;
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx && !audioCtxRef.current) {
          audioCtxRef.current = new AudioCtx();
        }
        if (audioCtxRef.current?.state === 'suspended') {
          audioCtxRef.current.resume().catch(() => {});
        }
      } catch {
        // Silencio seguro
      }
    };
    window.addEventListener('pointerdown', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, []);

  const playTone = (kind) => {
    if (!soundEnabled || !audioUnlockedRef.current || typeof window === 'undefined') {
      return;
    }
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current) audioCtxRef.current = new AudioCtx();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') return;

      const now = ctx.currentTime;
      const playNote = (type, f1, f2, dur, vol, delay = 0) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(f1, now + delay);
        if (f2 !== f1) {
          osc.frequency.exponentialRampToValueAtTime(f2, now + delay + dur);
        }
        gain.gain.setValueAtTime(0.001, now + delay);
        gain.gain.linearRampToValueAtTime(vol, now + delay + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + dur);
        osc.start(now + delay);
        osc.stop(now + delay + dur + 0.02);
      };

      if (kind === 'click') {
        playNote('sine', 620, 680, 0.055, 0.09);
      } else if (kind === 'tab') {
        playNote('sine', 480, 590, 0.075, 0.095);
      } else if (kind === 'theme') {
        playNote('triangle', 420, 560, 0.09, 0.085);
      } else if (kind === 'export') {
        playNote('sine', 523, 523, 0.08, 0.09, 0);
        playNote('sine', 659, 784, 0.14, 0.095, 0.08);
      } else if (kind === 'autoOk') {
        playNote('sine', 494, 587, 0.09, 0.075);
      } else if (kind === 'alert') {
        playNote('sine', 587, 698, 0.14, 0.1);
      } else if (kind === 'criticalCalm') {
        // Acorde resonante grave-medio distinguible sin asustar ni alarmar
        playNote('sine', 330, 330, 0.28, 0.09, 0);
        playNote('triangle', 440, 392, 0.3, 0.075, 0.12);
      } else if (kind === 'approve') {
        playNote('sine', 523, 659, 0.11, 0.1, 0);
        playNote('sine', 659, 784, 0.15, 0.1, 0.09);
      } else if (kind === 'block') {
        playNote('triangle', 340, 220, 0.16, 0.11, 0);
        playNote('sine', 220, 185, 0.14, 0.09, 0.11);
      } else if (kind === 'error429') {
        playNote('sawtooth', 210, 155, 0.2, 0.09);
      } else if (kind === 'verify') {
        playNote('sine', 740, 880, 0.1, 0.09);
      }
    } catch {
      // Silencio seguro
    }
  };

  // Persistir sesión completa automáticamente
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
        })
      );
    } catch {
      // Ignorar
    }
  }, [entered, activeTab, aiEnabled, autoStream, model, events]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(STORAGE_THEME_KEY, theme);
    } catch {
      // Ignorar
    }
  }, [theme]);

  // Calcular hash SHA-256 en tiempo real para el laboratorio 4
  useEffect(() => {
    let mounted = true;
    computeSha256Hex(cryptoPayload).then((hex) => {
      if (!mounted) return;
      setCurrentHash(hex);
      if (!sealedHash) setSealedHash(hex);
    });
    return () => {
      mounted = false;
    };
  }, [cryptoPayload]);

  // Cerrar menú Exportar al hacer clic fuera
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

  // Reaparición automática de notificación tras 5 minutos si siguen existiendo alertas
  useEffect(() => {
    if (!notifSnoozedUntil) return undefined;
    const wait = Math.max(0, notifSnoozedUntil - Date.now());
    const timer = setTimeout(() => {
      setNotifSnoozedUntil(0);
    }, wait);
    return () => clearTimeout(timer);
  }, [notifSnoozedUntil]);

  const currentTour = tourStep !== null ? TOUR_STEPS[tourStep] : null;
  const isDeckSpotlight =
    currentTour?.id === 'kpis' || currentTour?.id === 'topbar-actions';

  useEffect(() => {
    if (!currentTour) return;
    setActiveTab(currentTour.tab);
    const timer = setTimeout(() => {
      if (currentTour.id === 'topbar-actions' || currentTour.id === 'kpis') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setTourPos('bottom');
        return;
      }
      const el = document.getElementById(`tour-${currentTour.id}`);
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

  // Rate Limiter + Log visual HTTP
  const limiterRef = useRef(
    createRateLimiter({ maxAttempts: 5, windowMs: 60000 })
  );
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

  const [clientCount, setClientCount] = useState(40);
  const [benchRunId, setBenchRunId] = useState(0);
  const benchmark = useMemo(
    () => runQueryBenchmark(clientCount, 15000),
    [clientCount, benchRunId]
  );

  const metrics = useMemo(
    () => computeDashboardMetrics(events, aiEnabled),
    [events, aiEnabled]
  );
  const pendingEvents = useMemo(
    () => events.filter((e) => e.status === 'PENDING'),
    [events]
  );
  const aiApprovedEvents = useMemo(
    () => events.filter((e) => e.status === 'AUTO_APPROVED'),
    [events]
  );

  // Correlación de incidentes del mismo origen
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

  const activeAdvisoryEvent = pendingEvents[0] || events[0] || null;

  const appendAiLog = (line) => {
    setAiLogs((prev) => [line, ...prev].slice(0, 3));
  };

  const processIncomingOperation = (forceRisky = false) => {
    setAiScanning(true);
    setTimeout(() => {
      seqRef.current += 1;
      const evaluated = generateRandomEvent(model, seqRef.current, forceRisky);

      if (!aiEnabled) {
        // IA apagada: los casos siguen entrando y pasan directamente al humano
        setEvents((prev) => [evaluated, ...prev].slice(0, 28));
        appendAiLog(
          `[${evaluated.timestamp}] IA APAGADA: ${evaluated.id} «${evaluated.title}» derivado a tu cola.`
        );
        playTone(evaluated.risk.score >= 75 ? 'criticalCalm' : 'alert');
      } else if (evaluated.risk.score === 0 && !forceRisky) {
        const autoSafeEvt = {
          ...evaluated,
          status: 'AUTO_APPROVED',
          note: 'Aprobada por IA (100% segura). Verificación humana disponible.',
        };
        setEvents((prev) => [autoSafeEvt, ...prev].slice(0, 28));
        appendAiLog(
          `[${evaluated.timestamp}] IA aprobó al 100% de seguridad ${autoSafeEvt.id} «${autoSafeEvt.title}».`
        );
        playTone('autoOk');
      } else {
        setEvents((prev) => [evaluated, ...prev].slice(0, 28));
        appendAiLog(
          `[${evaluated.timestamp}] IA escaló ${evaluated.id} (${evaluated.risk.score}% riesgo) · ${evaluated.risk.legal.law}.`
        );
        playTone(evaluated.risk.score >= 75 ? 'criticalCalm' : 'alert');
      }
      setAiScanning(false);
    }, 380);
  };

  // Tráfico en vivo: sigue entrando incluso si la IA está apagada (hasta 12 pendientes)
  useEffect(() => {
    if (!entered || !autoStream || tourStep !== null) return undefined;
    const interval = setInterval(() => {
      if (pendingEvents.length >= 12) return;
      processIncomingOperation(false);
    }, 4200);
    return () => clearInterval(interval);
  }, [entered, autoStream, tourStep, pendingEvents.length, model, aiEnabled]);

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

  const handleOpenModal = (evt) => {
    playTone('click');
    setActiveTab('console');
    setSelectedEventId(evt.id);
    setNoteInput(evt.note || '');
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
      `[Aprendizaje #${training.model.updatesCount}] ${newStatus === 'BLOCKED' ? 'Denegaste' : 'Aprobaste'} ${selectedEvent.id} (riesgo: ${training.prevScore}% → ${training.newScore}%).`
    );
    playTone(newStatus === 'BLOCKED' ? 'block' : 'approve');
    setSelectedEventId(null);
    setNoteInput('');
    setTimeout(() => setIsResolving(false), 180);
  };

  const handleExport = (format) => {
    playTone('export');
    setExportOpen(false);
    const dateTag = new Date().toISOString().slice(0, 10);

    const groupedByAccount = {};
    events.forEach((e) => {
      if (!groupedByAccount[e.account]) groupedByAccount[e.account] = [];
      groupedByAccount[e.account].push(e);
    });

    if (format === 'csv') {
      const header =
        'Cuenta;IncidentesEnCuenta;ID;Categoria;Operacion;ImporteEUR;Riesgo%;Estado;Normativa;Nota\n';
      const rows = events
        .map((e) =>
          [
            escapeCsvCell(e.account),
            groupedByAccount[e.account].length,
            escapeCsvCell(e.id),
            escapeCsvCell(e.risk.threatCategory),
            escapeCsvCell(e.title),
            e.amount || 0,
            e.risk.score,
            escapeCsvCell(e.status),
            escapeCsvCell(e.risk.legal?.law || ''),
            escapeCsvCell(e.note || ''),
          ].join(';')
        )
        .join('\n');
      downloadFile(
        `\uFEFF${header}${rows}`,
        `sentinel-hitl-agrupado-${dateTag}.csv`,
        'text/csv;charset=utf-8'
      );
      return;
    }

    if (format === 'txt') {
      const clustersTxt = Object.entries(groupedByAccount)
        .map(
          ([acc, list]) =>
            `\n[CUENTA: ${acc}] (${list.length} evento/s)\n` +
            list
              .map(
                (e) =>
                  `  - ${e.id} | ${e.status} | Riesgo ${e.risk.score}% | ${e.title} (${e.amount || 0} €)`
              )
              .join('\n')
        )
        .join('\n');
      const summary = [
        `INFORME DE AUDITORÍA AGRUPADO · SENTINEL HITL (${dateTag})`,
        `==========================================================`,
        `Aprobadas por IA (100% seguras): ${metrics.aiApproved}`,
        `Resueltas en total (IA + Humano): ${metrics.totalResolved}`,
        `Capital protegido: ${metrics.protectedCapital.toLocaleString('es-ES')} €`,
        `Estado actual: ${metrics.statusDetail}`,
        clustersTxt,
      ].join('\n');
      downloadFile(
        summary,
        `sentinel-hitl-resumen-${dateTag}.txt`,
        'text/plain;charset=utf-8'
      );
      return;
    }

    downloadFile(
      JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          system: 'Sentinel HITL',
          model,
          metrics,
          groupedIncidents: groupedByAccount,
        },
        null,
        2
      ),
      `sentinel-hitl-modelo-${dateTag}.json`,
      'application/json'
    );
  };

  const handleDownloadManual = () => {
    playTone('export');
    const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"/><title>Documentación Técnica · Sentinel HITL</title>
<style>
  body{font-family:system-ui,-apple-system,sans-serif;color:#0b1426;max-width:880px;margin:24px auto;padding:34px;line-height:1.6}
  header{display:flex;align-items:center;gap:16px;border-bottom:3px solid #1d4ed8;padding-bottom:16px;margin-bottom:24px}
  h1{margin:0;font-size:26px;color:#071326} .meta{color:#475569;font-size:14px;margin-top:4px}
  h2{color:#1d4ed8;font-size:18px;margin-top:26px;border-bottom:1px solid #cbd5e1;padding-bottom:5px}
  .box{background:#f4f7fc;border:1px solid #cbd5e1;border-radius:10px;padding:14px 18px;margin:12px 0}
  ul{padding-left:20px} li{margin-bottom:7px;font-size:14px}
  footer{margin-top:34px;padding-top:14px;border-top:2px solid #071326;display:flex;justify-content:space-between;font-size:13px}
  a{color:#1d4ed8;font-weight:700;text-decoration:none}
</style></head><body>
<header>
  <svg width="48" height="48" viewBox="0 0 64 64" fill="none"><path d="M32 4L55 13V30.5C55 44.8 45.2 55.8 32 60C18.8 55.8 9 44.8 9 30.5V13L32 4Z" fill="#1d4ed8" stroke="#071326" stroke-width="3"/><circle cx="32" cy="31" r="7" fill="#38bdf8"/></svg>
  <div>
    <h1>Sentinel HITL · Documentación Técnica y Manual de Uso</h1>
    <div class="meta">Arquitectura Antifraude con IA* Supervisada (HITL) · Autor: Roberto Di Giovanni Igartua</div>
  </div>
</header>
<h2>1. Propósito y Alcance Real</h2>
<div class="box">
  <p>Sentinel HITL es una consola interactiva de seguridad bancaria ejecutada en cliente (serverless en GitHub Pages) para demostrar de forma verificable ingeniería Frontend avanzada, Machine Learning online con regularización L2, control de accesos y seguridad web estándar.</p>
</div>
<h2>2. Cooperación Humano-IA y Normativa de España</h2>
<ul>
  <li><strong>Regla 100% Segura:</strong> La IA solo aprueba automáticamente casos con 0% de riesgo, mostrándolos en una columna paralela de tarjetas contraídas para auditoría humana.</li>
  <li><strong>Asesoría Normativa:</strong> Cruza cada incidente con PSD2 (SCA/TRA), Ley 10/2010 PBC-FT (SEPBLAC), RGPD/LOPDGDD y Circular 4/2017 del Banco de España.</li>
  <li><strong>Correlación de Incidentes:</strong> Agrupa automáticamente múltiples alertas de la misma cuenta tanto en interfaz como en las exportaciones (.CSV con protección anti-inyección de fórmulas, .TXT y .JSON).</li>
</ul>
<h2>3. Seis Pruebas Técnicas Verificables en Vivo y en Consola F12</h2>
<ul>
  <li><strong>Escudo HTTP 429:</strong> Limitador de ventana deslizante (5 intentos / 60s) con traza HTTP.</li>
  <li><strong>Benchmark Real 15.000 Operaciones:</strong> Generación en RAM y comparación N+1 vs. Map (&gt;70% menos tiempo).</li>
  <li><strong>Escudo Anti-XSS:</strong> Neutralización en vivo de inyecciones HTML/script.</li>
  <li><strong>Sello Criptográfico SHA-256:</strong> Integridad real mediante Web Crypto API.</li>
  <li><strong>Anti-CSRF + Idempotencia (409 Conflict):</strong> Prevención de doble cargo y Replay Attacks.</li>
  <li><strong>Auditoría de Seguridad del Navegador:</strong> Inspección de CSP, Referrer-Policy, enlaces y persistencia.</li>
</ul>
<footer>
  <div><strong>Autor:</strong> Roberto Di Giovanni Igartua · Full Stack (React · FastAPI · SQL)</div>
  <div><a href="${LINKEDIN_URL}">LinkedIn</a> · <a href="${GITHUB_PROFILE_URL}">GitHub</a></div>
</footer>
</body></html>`;
    downloadFile(html, 'Sentinel-HITL-Documentacion-Completa.html', 'text/html;charset=utf-8');
  };

  // --- Handlers del Laboratorio (con trazas reales en F12 DevTools) ---
  const handleSimulateLogin = () => {
    const res = limiterRef.current.attempt();
    const time = new Date().toLocaleTimeString('es-ES');
    setLoginStatus({
      ...res,
      message: res.allowed
        ? `Acceso permitido (${res.attempts}/${res.maxAttempts} intentos en 60s)`
        : 'BLOQUEO ACTIVO: Límite superado (HTTP 429 Too Many Requests)',
    });
    setHttpLogs((prev) =>
      [
        `[${time}] POST /api/auth/login → HTTP ${res.status} ${res.allowed ? 'OK' : 'TOO MANY REQUESTS'}`,
        ...prev,
      ].slice(0, 4)
    );
    console.info('[Sentinel HTTP 429]', {
      endpoint: '/api/auth/login',
      status: res.status,
      attempts: res.attempts,
      retryAfterSec: res.retryAfterSec,
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
      message: 'Ventana reiniciada. Puerta de acceso operativa.',
    });
    setHttpLogs(['Contador reiniciado. Listo para nuevas peticiones.']);
  };

  const handleRunBenchmark = (newClients = clientCount) => {
    playTone('verify');
    setClientCount(newClients);
    setBenchRunId((id) => id + 1);
    const snap = runQueryBenchmark(newClients, 15000);
    console.groupCollapsed(`[Sentinel Benchmark] 15.000 ops · ${newClients} clientes`);
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
      csrfValid: !forgedCsrf,
      response: res,
    });
    playTone(res.ok ? 'approve' : 'error429');
  };

  const handleRunBrowserAudit = () => {
    playTone('verify');
    const cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    const refMeta = document.querySelector('meta[name="referrer"]');
    const unsafeLinks = Array.from(document.querySelectorAll('a[target="_blank"]')).filter(
      (a) => !(a.rel || '').includes('noopener')
    ).length;

    const report = [
      {
        control: 'Content-Security-Policy (CSP)',
        estado: cspMeta ? 'ACTIVA' : 'AUSENTE',
        detalle: cspMeta ? 'Política restrictiva (object-src none)' : 'Sin meta CSP',
      },
      {
        control: 'Referrer-Policy',
        estado: refMeta ? 'ACTIVA' : 'AUSENTE',
        detalle: refMeta?.content || 'Por defecto',
      },
      {
        control: 'Enlaces externos (Anti-Tabnabbing)',
        estado: unsafeLinks === 0 ? 'SEGURO' : 'REVISAR',
        detalle: `${unsafeLinks} enlaces sin rel="noopener noreferrer"`,
      },
      {
        control: 'Web Crypto API (SHA-256)',
        estado: typeof crypto?.subtle !== 'undefined' ? 'DISPONIBLE' : 'FALLBACK',
        detalle: window.isSecureContext ? 'Contexto seguro verificado' : 'Contexto local',
      },
      {
        control: 'CSV Formula Injection Guard',
        estado: 'ACTIVO',
        detalle: 'Neutraliza celdas que inicien con = + - @',
      },
    ];
    setAuditChecks(report);
    console.group('[Sentinel Security Audit]');
    console.table(report);
    console.groupEnd();
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
    setAiEnabled(true);
    setAutoStream(true);
    setNotifSnoozedUntil(0);
    setSelectedEventId(null);
    setNoteInput('');
    setAiLogs([
      'Sesión reiniciada con nuevos casos aleatorios.',
      'Normativa España activa: PSD2, SEPBLAC, RGPD y Banco de España.',
    ]);
    handleResetLimiter();
  };

  const isSpot = (id) => currentTour?.id === id;
  const isNotifSnoozed = notifSnoozedUntil > Date.now();
  const showNotifications =
    !currentTour && !selectedEvent && pendingEvents.length > 0 && !isNotifSnoozed;
  const cryptoIntact = sealedHash && currentHash === sealedHash;

  if (!entered) {
    return (
      <>
        <BackgroundCrystalWaves />
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
                  <SentinelBrandIcon size={24} /> Arquitectura Antifraude con
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
                anti-CSRF/XSS y optimización real sobre 15.000 transacciones.
              </p>
              <div className="hero-specs mono">
                <span className="hero-spec-tag">LogReg Online + L2</span>
                <span className="hero-spec-tag">Rate Limiter HTTP 429</span>
                <span className="hero-spec-tag">Benchmark 15.000 ops</span>
                <span className="hero-spec-tag">Web Crypto SHA-256</span>
                <span className="hero-spec-tag">Anti-CSRF &amp; Anti-XSS</span>
                <span className="hero-spec-tag">CSP + Vitest TDD</span>
              </div>
            </div>

            <div className="welcome-body">
              <div className="feature-grid">
                <article className="feature-box">
                  <span className="step-num mono">01</span>
                  <h3>IA* + Normativa España</h3>
                  <p>
                    Aprueba sola únicamente al 100% de seguridad (auditable) y
                    asesora al agente con directrices PSD2, SEPBLAC y RGPD.
                  </p>
                </article>
                <article className="feature-box">
                  <span className="step-num mono">02</span>
                  <h3>6 Defensas Verificables (F12)</h3>
                  <p>
                    Pon a prueba HTTP 429, Anti-XSS, SHA-256, Idempotencia
                    Anti-CSRF y Auditoría CSP con trazas en vivo en F12.
                  </p>
                </article>
                <article className="feature-box">
                  <span className="step-num mono">03</span>
                  <h3>15.000 Operaciones Reales</h3>
                  <p>
                    Verifica en tu procesador cómo la agregación indexada
                    reduce más de un 70% la latencia frente al patrón N+1.
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
                    style={{ padding: '0.95rem 1.8rem', fontSize: '1rem' }}
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

      {/* BLOQUE ANCLADO SUPERIOR: Cabecera + KPIs + Menú 1-2-3 */}
      <div
        className={`sticky-command-deck ${currentTour ? 'tour-locked' : ''} ${
          isDeckSpotlight ? 'tour-elevated' : ''
        }`}
      >
        <header
          id="tour-topbar-actions"
          className="topbar-wrap"
          style={
            isSpot('topbar-actions')
              ? {
                  position: 'relative',
                  zIndex: 64,
                  boxShadow:
                    '0 0 0 4px #38bdf8, 0 14px 36px rgba(2, 132, 199, 0.55)',
                }
              : undefined
          }
        >
          <div className="topbar">
            <div className="brand">
              <button
                className={`shield-4d-btn ${!autoStream ? 'is-paused' : ''}`}
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
                <SentinelBrandIcon size={34} paused={!autoStream} />
              </button>
              <div>
                <h1>Sentinel HITL</h1>
                <span className="brand-sub mono">
                  <span
                    className={`live-dot ${metrics.threatLevel === 'ELEVADO' ? 'danger' : ''}`}
                  />
                  {!autoStream
                    ? 'PAUSADO (pulsa el escudo)'
                    : aiScanning
                      ? 'ANALIZANDO OPERACIÓN...'
                      : `EN VIVO · IA ${aiEnabled ? 'ACTIVA' : 'APAGADA (MODO HUMANO)'}`}
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
                title="Si apagas la IA, los casos siguen entrando y pasan todos al humano"
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
            className={`kpi-grid ${isSpot('kpis') ? 'tour-spotlight' : ''}`}
            aria-label="Métricas principales"
          >
            <div className="card kpi-card">
              <div className="kpi-label">Tus Casos Pendientes</div>
              <div className="kpi-value mono">{metrics.pending}</div>
              <div className="kpi-sub">
                {metrics.criticalPending > 0
                  ? `${metrics.criticalPending} críticas requieren acción`
                  : 'Casos con riesgo > 0%'}
              </div>
            </div>
            <div className="card kpi-card">
              <div className="kpi-label">Aprobadas por IA</div>
              <div className="kpi-value mono" style={{ color: 'var(--accent)' }}>
                {metrics.aiResolved}
              </div>
              <div className="kpi-sub">Solo 100% seguras (auditables)</div>
            </div>
            <div className="card kpi-card">
              <div className="kpi-label">Resueltas en Total</div>
              <div className="kpi-value mono">{metrics.totalResolved}</div>
              <div className="kpi-sub">
                {metrics.humanResolved} humano · {metrics.aiApproved} IA
              </div>
            </div>
            <div className="card kpi-card">
              <div className="kpi-label">Capital Protegido</div>
              <div className="kpi-value mono" style={{ color: 'var(--success)' }}>
                {metrics.protectedCapital.toLocaleString('es-ES')} €
              </div>
              <div className="kpi-sub">{metrics.statusDetail}</div>
            </div>
          </section>

          <nav className="tabs" aria-label="Secciones principales">
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
            <div className="section-intro">
              <h2>Supervisión Antifraude y Asesoría Legal en Vivo</h2>
              <p>
                La IA aprueba únicamente operaciones 100% seguras (revisables a
                la derecha) y te asiste con la normativa española en cada alerta.
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
                <strong style={{ fontSize: '1.04rem', color: '#7dd3fc' }}>
                  Cerebro Sentinel AI · Normativa España (Actualización diaria)
                </strong>
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
                  <div
                    className="mono"
                    style={{
                      fontSize: '0.78rem',
                      color: '#38bdf8',
                      marginBottom: '0.35rem',
                    }}
                  >
                    RECOMENDACIÓN LEGAL ACTIVA ·{' '}
                    {activeAdvisoryEvent?.id || 'EN ESPERA'}
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
                      marginBottom: '0.4rem',
                    }}
                  >
                    FEEDBACK EN VIVO · AJUSTES DEL MODELO: {model.updatesCount}
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
                <h3 className="column-title">
                  <span>Tus Casos Pendientes ({pendingEvents.length})</span>
                </h3>
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
                          className={`event-item animate-in ${
                            group.isCluster
                              ? 'is-grouped'
                              : evt.risk.level === 'CRÍTICO'
                                ? 'is-critical'
                                : ''
                          }`}
                        >
                          <div style={{ flex: '1 1 260px' }}>
                            <div
                              style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '0.45rem',
                                marginBottom: '0.45rem',
                              }}
                            >
                              {group.isCluster && (
                                <span className="badge badge-high">
                                  ALERTA AGRUPADA · {group.items.length} casos
                                  del mismo origen
                                </span>
                              )}
                              <span className="badge badge-critical">
                                Riesgo IA: {group.maxScore}%
                              </span>
                              <span className="badge badge-ai">
                                {evt.risk.threatCategory}
                              </span>
                            </div>
                            <strong
                              style={{ display: 'block', fontSize: '1.08rem' }}
                            >
                              {group.isCluster
                                ? `Múltiples alertas en ${group.account}`
                                : evt.title}
                              {group.totalAmount > 0
                                ? ` · ${group.totalAmount.toLocaleString('es-ES')} €`
                                : ''}
                            </strong>
                            <div
                              style={{
                                fontSize: '0.88rem',
                                color: 'var(--text-muted)',
                                marginTop: '0.2rem',
                              }}
                            >
                              {evt.account} · {evt.location} ·{' '}
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
                                    {sub.title} ({sub.risk.score}%)
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
                <h3 className="column-title">
                  <span>
                    Aprobadas IA · 100% Seguras ({aiApprovedEvents.length})
                  </span>
                </h3>
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
                        Aún no hay operaciones 100% seguras aprobadas por IA.
                      </p>
                    </div>
                  ) : (
                    aiApprovedEvents.map((evt) => (
                      <div key={evt.id} className="compact-card animate-in">
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              display: 'flex',
                              gap: '0.45rem',
                              alignItems: 'center',
                              marginBottom: '0.2rem',
                            }}
                          >
                            <span className="badge badge-ok">100% Segura</span>
                            <span
                              className="mono"
                              style={{
                                fontSize: '0.78rem',
                                color: 'var(--text-muted)',
                              }}
                            >
                              {evt.id}
                            </span>
                          </div>
                          <strong
                            style={{
                              display: 'block',
                              fontSize: '0.92rem',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {evt.title}
                          </strong>
                          <span
                            style={{
                              fontSize: '0.8rem',
                              color: 'var(--text-muted)',
                            }}
                          >
                            {evt.account}
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
          <section className="animate-in">
            <div className="section-intro">
              <h2>Defensa Activa y Rendimiento (6 Pruebas Verificables en F12)</h2>
              <p>
                Pulsa cualquier prueba y abre la consola del navegador (
                <span className="mono">F12</span>) para inspeccionar en vivo las
                trazas reales de seguridad, criptografía y rendimiento.
              </p>
            </div>

            <div className="lab-grid">
              {/* 1. HTTP 429 */}
              <article
                id="tour-lab-429"
                className={`card ${isSpot('lab-429') ? 'tour-spotlight' : ''}`}
              >
                <span className="badge badge-critical">
                  1. Escudo de Acceso (HTTP 429)
                </span>
                <h3 style={{ margin: '0.65rem 0 0.35rem', fontSize: '1.18rem' }}>
                  Bloqueo contra fuerza bruta
                </h3>
                <p
                  style={{
                    margin: '0 0 0.6rem',
                    fontSize: '0.9rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  Ventana deslizante de 5 intentos/min. Al 6.º intento devuelve{' '}
                  <strong>HTTP 429</strong> y registra la traza en F12.
                </p>

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
                      style={{
                        color: l.includes('429') ? '#f87171' : '#86efac',
                      }}
                    >
                      {l}
                    </div>
                  ))}
                </div>

                {loginStatus.retryAfterSec > 0 && (
                  <div
                    className="mono"
                    style={{
                      marginBottom: '0.8rem',
                      color: 'var(--danger)',
                      fontWeight: 800,
                    }}
                  >
                    BLOQUEADO · Reintento en {loginStatus.retryAfterSec}s
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap' }}>
                  <button
                    className="btn-danger"
                    onClick={handleSimulateLogin}
                    disabled={loginStatus.status === 429}
                  >
                    Simular acceso ({loginStatus.attempts}/5)
                  </button>
                  <button className="btn-secondary" onClick={handleResetLimiter}>
                    Reiniciar
                  </button>
                </div>
              </article>

              {/* 2. Benchmark Real 15.000 ops */}
              <article
                id="tour-lab-n1"
                className={`card ${isSpot('lab-n1') ? 'tour-spotlight' : ''}`}
              >
                <span className="badge badge-ok">
                  2. Rendimiento Real (-{benchmark.reductionPct}% tiempo)
                </span>
                <h3 style={{ margin: '0.65rem 0 0.35rem', fontSize: '1.18rem' }}>
                  Agregación real de 15.000 operaciones
                </h3>
                <p
                  style={{
                    margin: '0 0 0.85rem',
                    fontSize: '0.9rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  Total verificado:{' '}
                  <strong className="mono">
                    {benchmark.totalVolumeEur.toLocaleString('es-ES')} €
                  </strong>{' '}
                  ({benchmark.totalsMatch ? 'Coincidencia 100%' : ''}).
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
                      onClick={() => handleRunBenchmark(n)}
                    >
                      {n} clientes
                    </button>
                  ))}
                  <button
                    className="btn-secondary"
                    onClick={() => handleRunBenchmark(clientCount)}
                  >
                    Medir + F12
                  </button>
                </div>

                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '0.86rem',
                    }}
                  >
                    <span>
                      N+1 ({benchmark.nPlusOne.iterations.toLocaleString('es-ES')}{' '}
                      iter.)
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
                      fontSize: '0.86rem',
                    }}
                  >
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
              <article className="card">
                <span className="badge badge-ai">3. Sanitización Anti-XSS</span>
                <h3 style={{ margin: '0.65rem 0 0.35rem', fontSize: '1.18rem' }}>
                  Neutralización de scripts en vivo
                </h3>
                <p
                  style={{
                    margin: '0 0 0.75rem',
                    fontSize: '0.9rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  Escribe código malicioso (<span className="mono">&lt;script&gt;</span>
                  , <span className="mono">&lt;img onerror=...&gt;</span>) y
                  comprueba el saneado antes de guardar notas.
                </p>
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
                <div
                  style={{
                    marginTop: '0.9rem',
                    padding: '0.85rem',
                    borderRadius: 10,
                    background: 'var(--success-bg)',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      color: 'var(--success)',
                      marginBottom: '0.25rem',
                    }}
                  >
                    SALIDA SEGURA:
                  </div>
                  <div className="mono" style={{ fontSize: '0.86rem' }}>
                    {sanitizeNote(xssInput, 160) || '(vacío)'}
                  </div>
                </div>
              </article>

              {/* 4. NUEVA: Criptografía SHA-256 */}
              <article className="card">
                <span className="badge badge-ai">
                  4. Web Crypto API (SHA-256)
                </span>
                <h3 style={{ margin: '0.65rem 0 0.35rem', fontSize: '1.18rem' }}>
                  Sello criptográfico de integridad
                </h3>
                <p
                  style={{
                    margin: '0 0 0.65rem',
                    fontSize: '0.9rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  Firma el registro de auditoría con <strong>SHA-256</strong>{' '}
                  nativo. Cambia 1 solo carácter del texto y verás cómo detecta
                  la alteración al instante.
                </p>
                <input
                  className="xss-input mono"
                  value={cryptoPayload}
                  onChange={(e) => setCryptoPayload(e.target.value)}
                />
                <div className="hash-box mono">
                  {currentHash || 'Calculando SHA-256...'}
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.6rem',
                    flexWrap: 'wrap',
                  }}
                >
                  <span
                    className={`badge ${cryptoIntact ? 'badge-ok' : 'badge-critical'}`}
                  >
                    {cryptoIntact
                      ? 'INTEGRIDAD VERIFICADA'
                      : 'ALTERACIÓN DETECTADA'}
                  </span>
                  <button className="btn-secondary" onClick={handleSealCrypto}>
                    Sellar y volcar a F12
                  </button>
                </div>
              </article>

              {/* 5. NUEVA: Anti-CSRF + Idempotencia */}
              <article className="card">
                <span className="badge badge-high">
                  5. Anti-CSRF + Idempotencia (409)
                </span>
                <h3 style={{ margin: '0.65rem 0 0.35rem', fontSize: '1.18rem' }}>
                  Prevención de doble cobro y Replay
                </h3>
                <p
                  style={{
                    margin: '0 0 0.7rem',
                    fontSize: '0.9rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  Clave activa: <strong className="mono">{activeIdempKey}</strong>
                  . Envía dos veces la misma orden para ver el bloqueo{' '}
                  <strong>HTTP 409</strong> o simula un token CSRF forjado (
                  <strong>403</strong>).
                </p>
                <div className="http-log mono">
                  {idempLog.map((l, i) => (
                    <div
                      key={i}
                      style={{
                        color: l.includes('201') ? '#86efac' : '#f87171',
                      }}
                    >
                      {l}
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
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
                    Simular CSRF inválido
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

              {/* 6. NUEVA: Auditoría de Seguridad del Navegador */}
              <article className="card">
                <span className="badge badge-ok">
                  6. Auditoría Hardening (CSP + DOM)
                </span>
                <h3 style={{ margin: '0.65rem 0 0.35rem', fontSize: '1.18rem' }}>
                  Verificador de seguridad en vivo
                </h3>
                <p
                  style={{
                    margin: '0 0 0.9rem',
                    fontSize: '0.9rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  Inspecciona en directo las protecciones estándar activas en
                  esta web e imprime la tabla completa en consola{' '}
                  <span className="mono">F12</span>.
                </p>
                <button
                  className="btn-primary"
                  style={{ marginBottom: '0.9rem' }}
                  onClick={handleRunBrowserAudit}
                >
                  Ejecutar auditoría + console.table()
                </button>
                {auditChecks && (
                  <table className="sample-table mono">
                    <thead>
                      <tr>
                        <th>Control</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditChecks.map((row) => (
                        <tr key={row.control}>
                          <td>{row.control}</td>
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
        )}

        {activeTab === 'quality' && (
          <section className="animate-in">
            <div className="section-intro">
              <h2>Ingeniería Aplicada y Autoría</h2>
              <p>
                Arquitectura real verificable, documentación técnica descargable
                y contacto profesional.
              </p>
            </div>

            <div
              id="tour-quality-author"
              className={`lab-grid ${isSpot('quality-author') ? 'tour-spotlight' : ''}`}
            >
              <article className="card">
                <span className="badge badge-ok">Arquitectura Verificada</span>
                <h3 style={{ margin: '0.65rem 0 0.6rem', fontSize: '1.2rem' }}>
                  Desarrollo y propósito de Sentinel HITL
                </h3>
                <ul
                  style={{
                    margin: '0 0 1.3rem',
                    paddingLeft: '1.2rem',
                    fontSize: '0.94rem',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.55rem',
                  }}
                >
                  <li>
                    <strong style={{ color: 'var(--text)' }}>
                      ML Online + Normativa España:
                    </strong>{' '}
                    Regresión Logística con regularización L2, aprobación
                    autónoma solo al 100% de seguridad y asesoría PSD2/SEPBLAC.
                  </li>
                  <li>
                    <strong style={{ color: 'var(--text)' }}>
                      Hardening Web Estándar:
                    </strong>{' '}
                    CSP restrictiva, Referrer-Policy, protección contra CSV
                    Formula Injection, SHA-256 nativo e idempotencia Anti-CSRF.
                  </li>
                  <li>
                    <strong style={{ color: 'var(--text)' }}>
                      Calidad y Testing (Vitest):
                    </strong>{' '}
                    Suite unitaria automatizada, correlación de incidentes por
                    cuenta y persistencia de sesión segura en navegador.
                  </li>
                </ul>
                <button className="btn-primary" onClick={handleDownloadManual}>
                  Descargar Documentación Completa (Imprimible / PDF) ↓
                </button>
              </article>

              <article className="card">
                <span className="pill">Autor del proyecto</span>
                <h3 style={{ margin: '0.65rem 0 0.4rem', fontSize: '1.25rem' }}>
                  Roberto Di Giovanni Igartua
                </h3>
                <p
                  style={{
                    margin: '0 0 1.35rem',
                    fontSize: '0.95rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  Desarrollador Full Stack (React · FastAPI · SQL) enfocado en
                  seguridad de aplicaciones, sistemas con IA supervisada (HITL)
                  y calidad de software.
                </p>
                <div style={{ display: 'flex', gap: '0.7rem', flexWrap: 'wrap' }}>
                  <a
                    href={LINKEDIN_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-link btn-primary"
                  >
                    LinkedIn ↗
                  </a>
                  <a
                    href={GITHUB_PROFILE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-link btn-secondary"
                  >
                    Perfil GitHub ↗
                  </a>
                </div>
              </article>
            </div>
          </section>
        )}

        {/* Notificación cerrable (vuelve a los 5 minutos si persisten alertas) */}
        {showNotifications && (
          <aside className="toast-stack" aria-live="polite">
            <div className="toast-card animate-in">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.45rem',
                }}
              >
                <span className="badge badge-critical">
                  {pendingEvents.length}{' '}
                  {pendingEvents.length === 1
                    ? 'amenaza pendiente'
                    : 'amenazas pendientes'}
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
                  ? `Tienes ${pendingEvents.length} alertas esperando revisión`
                  : pendingEvents[0].title}
              </strong>
              <div
                style={{
                  fontSize: '0.82rem',
                  color: 'var(--text-muted)',
                  margin: '0.25rem 0 0.65rem',
                }}
              >
                Si cierras este aviso, volverá a recordártelo en 5 min si quedan
                alertas.
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

      {/* Guía Spotlight */}
      {currentTour && (
        <aside
          className={`tour-card pos-${tourPos} animate-in`}
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

          <h3 style={{ margin: '0 0 0.55rem', fontSize: '1.24rem' }}>
            {currentTour.title}
          </h3>
          <p
            style={{
              margin: '0 0 1.25rem',
              fontSize: '0.96rem',
              color: 'var(--text-muted)',
            }}
          >
            {currentTour.body}
          </p>

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

      {/* Modal HITL */}
      {selectedEvent && !currentTour && (
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
                marginBottom: '0.7rem',
              }}
            >
              <span className="badge badge-critical">
                Riesgo {selectedEvent.risk.score}% · Seguridad{' '}
                {selectedEvent.risk.safetyPct}%
              </span>
              <span className="mono" style={{ fontSize: '0.84rem' }}>
                {selectedEvent.id} · {selectedEvent.difficulty}
              </span>
            </div>

            <h3 style={{ margin: '0 0 0.3rem', fontSize: '1.25rem' }}>
              {selectedEvent.title}
              {selectedEvent.amount > 0
                ? ` (${selectedEvent.amount.toLocaleString('es-ES')} €)`
                : ''}
            </h3>
            <p
              style={{
                margin: '0 0 0.95rem',
                fontSize: '0.92rem',
                color: 'var(--text-muted)',
              }}
            >
              {selectedEvent.account} · {selectedEvent.location} ·{' '}
              {selectedEvent.timestamp}
            </p>

            <div className="modal-ai-box">
              <strong
                style={{
                  color: '#7dd3fc',
                  display: 'block',
                  marginBottom: '0.35rem',
                }}
              >
                {selectedEvent.risk.legal?.law}
              </strong>
              <div style={{ color: '#cbd5e1', marginBottom: '0.35rem' }}>
                <strong>Vacío / Riesgo:</strong> {selectedEvent.risk.legal?.gap}
              </div>
              <div style={{ color: '#6ee7b7' }}>
                <strong>Recomendación:</strong>{' '}
                {selectedEvent.risk.legal?.guidance}
              </div>
            </div>

            <label
              htmlFor="hitl-note"
              style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700 }}
            >
              Nota de auditoría (opcional)
            </label>
            <textarea
              id="hitl-note"
              className="modal-textarea"
              maxLength={160}
              placeholder="Ej.: Titular confirmado por teléfono; se autoriza."
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
            />
            <div
              className="mono"
              style={{
                textAlign: 'right',
                fontSize: '0.78rem',
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
                gap: '0.6rem',
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
                Denegar / Bloquear
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}