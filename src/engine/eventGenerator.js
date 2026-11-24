import { createInitialModel, evaluateRiskEvent } from './securityEngine';

export const STORAGE_SESSION_KEY = 'sentinel_hitl_session_v7';
export const STORAGE_THEME_KEY = 'sentinel_hitl_theme_v1';

const ACCOUNTS_POOL = [
  { account: 'ES91 •••• 4821 (Tesorería Corp.)', type: 'FINANCIAL' },
  { account: 'ES44 •••• 1093 (Cuenta Operativa)', type: 'FINANCIAL' },
  { account: 'ES21 •••• 3301 (Nóminas RRHH)', type: 'FINANCIAL' },
  { account: 'ES18 •••• 9912 (Suministros)', type: 'FINANCIAL' },
  { account: 'ES77 •••• 6510 (Fondo Liquidez)', type: 'FINANCIAL' },
  { account: 'ES63 •••• 4402 (Compras IT)', type: 'FINANCIAL' },
  { account: 'ES55 •••• 2219 (Comercio Exterior)', type: 'FINANCIAL' },
  { account: 'ES04 •••• 8810 (Fiscalidad AEAT)', type: 'FINANCIAL' },
  { account: 'admin.finanzas@empresa.es', type: 'ACCESS' },
  { account: 'svc-pagos-api@empresa.es', type: 'ACCESS' },
  { account: 'laura.gomez@empresa.es', type: 'ACCESS' },
  { account: 'direccion.ops@empresa.es', type: 'ACCESS' },
  { account: 'marta.sanz@empresa.es', type: 'ACCESS' },
  { account: 'tesoreria.b2b@empresa.es', type: 'ACCESS' },
];

const SAFE_FINANCIAL_TITLES = [
  'Pago de nómina mensual nacional',
  'Domiciliación eléctrica recurrente',
  'Liquidación trimestral AEAT',
  'Cuota Seguridad Social (TGSS)',
  'Abono alquiler sede central Madrid',
  'Factura telefonía corporativa habitual',
];

const RISKY_FINANCIAL_TITLES = [
  'Transferencia urgente a proveedor sin historial',
  'Pago fraccionado justo bajo umbral SEPBLAC',
  'Liquidación nocturna en divisa extranjera',
  'Retirada de liquidez a cuenta offshore',
  'Transferencia SEPA inmediata fuera de horario',
  'Compra atípica de activos digitales corporativos',
  'Anticipo extraordinario a intermediario externo',
];

const SAFE_ACCESS_TITLES = [
  'Inicio de sesión habitual desde sede central',
  'Consulta de saldos desde app corporativa verificada',
  'Descarga de extracto mensual desde IP autorizada',
];

const RISKY_ACCESS_TITLES = [
  'Acceso administrativo con viaje imposible',
  'Intento de escalado de privilegios en API bancaria',
  'Cambio de contraseña desde red pública no confiable',
  'Múltiples intentos fallidos sobre cuenta tesorera',
  'Vinculación de dispositivo no reconocido fuera de horario',
  'Exportación masiva de mandatos desde VPN externa',
];

const SAFE_LOCATIONS = [
  'Madrid (ES)',
  'Barcelona (ES)',
  'Valencia (ES)',
  'Bilbao (ES)',
  'Sevilla (ES)',
];

const FOREIGN_LOCATIONS = [
  { name: 'Bucarest (RO)', delta: 0.15 },
  { name: 'Frankfurt (DE)', delta: 0.05 },
  { name: 'Londres (UK)', delta: 0.1 },
  { name: 'Varsovia (PL)', delta: 0.18 },
  { name: 'Singapur (SG)', delta: 0.35 },
  { name: 'Dubái (AE)', delta: 0.42 },
  { name: 'Islas Caimán (KY)', delta: 0.65 },
  { name: 'San Francisco (US)', delta: 0.2 },
  { name: 'Madrid → Tokio (9 min)', delta: 0.55 },
  { name: 'Barcelona → Lagos (14 min)', delta: 0.6 },
];

const CHANNELS = ['Web Banking', 'API PSD2', 'App Móvil iOS', 'Backoffice Admin'];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/**
 * Genera un evento realista único y calcula su puntuación personalizada con el modelo actual.
 */
export function generateRealisticEvent(model, seq, forceRisky = false) {
  const isSafe = !forceRisky && Math.random() < 0.32;
  const accObj = pick(ACCOUNTS_POOL);
  const timeStr = new Date().toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const channel = pick(CHANNELS);
  const ipPrefix = isSafe ? '83.42' : `185.${20 + Math.floor(Math.random() * 200)}`;
  const ip = `${ipPrefix}.${Math.floor(Math.random() * 255)}.${10 + Math.floor(Math.random() * 230)}`;

  let raw;
  if (isSafe) {
    raw = {
      id: `EVT-${seq}`,
      type: accObj.type,
      difficulty: 'Básica',
      title:
        accObj.type === 'FINANCIAL'
          ? pick(SAFE_FINANCIAL_TITLES)
          : pick(SAFE_ACCESS_TITLES),
      account: accObj.account,
      amount:
        accObj.type === 'FINANCIAL'
          ? 180 + Math.floor(Math.random() * 1100)
          : 0,
      foreignCountry: false,
      unusualHour: false,
      impossibleTravel: false,
      unknownDevice: false,
      failedAttempts: 0,
      location: pick(SAFE_LOCATIONS),
      channel,
      ip,
      contextRiskDelta: 0,
      timestamp: timeStr,
    };
  } else {
    const tierRoll = Math.random();
    const isCritical = tierRoll > 0.6;
    const isMedium = tierRoll > 0.25 && tierRoll <= 0.6;
    const geo = pick(FOREIGN_LOCATIONS);
    const impossibleTravel =
      isCritical && (accObj.type === 'ACCESS' || Math.random() > 0.5);
    const failedAttempts =
      accObj.type === 'ACCESS'
        ? isCritical
          ? 4 + Math.floor(Math.random() * 4)
          : 1 + Math.floor(Math.random() * 3)
        : isCritical && Math.random() > 0.5
          ? 3
          : 0;

    raw = {
      id: `EVT-${seq}`,
      type: accObj.type,
      difficulty: isCritical ? 'Crítica' : isMedium ? 'Sofisticada' : 'Media',
      title:
        accObj.type === 'FINANCIAL'
          ? pick(RISKY_FINANCIAL_TITLES)
          : pick(RISKY_ACCESS_TITLES),
      account: accObj.account,
      amount:
        accObj.type === 'FINANCIAL'
          ? isCritical
            ? 3800 + Math.floor(Math.random() * 5400)
            : 1650 + Math.floor(Math.random() * 2300)
          : 0,
      foreignCountry: isCritical || Math.random() > 0.35,
      unusualHour: isCritical || Math.random() > 0.55,
      impossibleTravel,
      unknownDevice: isCritical || accObj.type === 'ACCESS' || Math.random() > 0.45,
      failedAttempts,
      location: geo.name,
      channel,
      ip,
      contextRiskDelta: geo.delta + (Math.random() * 0.14 - 0.07),
      timestamp: timeStr,
    };
  }

  const risk = evaluateRiskEvent(raw, model);
  return { ...raw, risk, status: 'PENDING', note: '' };
}

export function createFreshSession() {
  const model = createInitialModel();
  const baseSeq = 1000 + Math.floor(Math.random() * 8000);
  const e1 = generateRealisticEvent(model, baseSeq, true);
  const e2 = generateRealisticEvent(model, baseSeq + 1, true);
  const e3 = generateRealisticEvent(model, baseSeq + 2, false);
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

export function loadSession() {
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
    // Recuperación segura si el almacenamiento está corrupto o manipulado
  }
  return createFreshSession();
}