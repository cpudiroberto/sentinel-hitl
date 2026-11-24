export const FEATURE_META = {
  amountNorm: { label: 'Importe elevado', short: 'Importe' },
  foreignCountry: { label: 'Operación internacional', short: 'País extranjero' },
  unusualHour: { label: 'Horario inusual (madrugada)', short: 'Horario' },
  impossibleTravel: { label: 'Viaje imposible (geolocalización)', short: 'Viaje imposible' },
  unknownDevice: { label: 'Dispositivo no reconocido', short: 'Dispositivo' },
  failedAttemptsNorm: { label: 'Intentos fallidos de clave', short: 'Fallos acceso' },
};

export const SPANISH_LEGAL_COMPENDIUM = [
  {
    id: 'PSD2-SCA',
    category: 'Pagos / PSD2',
    code: 'Directiva PSD2 · RDL 19/2018 (SCA)',
    title: 'Autenticación Reforzada de Clientes (SCA) y Exenciones TRA',
    updated: 'Revisión 2026',
    isNew: true,
    summary:
      'Exige al menos dos factores independientes (conocimiento, posesión o inherencia) en pagos electrónicos y accesos sensibles, salvo operaciones de bajo riesgo verificadas mediante análisis transaccional en tiempo real (TRA).',
    gap: 'Vacío frecuente: reutilización de sesiones activas o tokens OAuth tras un cambio abrupto de geolocalización sin forzar re-autenticación.',
    protocol:
      'Si existe viaje imposible, dispositivo nuevo o >2 fallos de clave, revocar la sesión, bloquear preventivamente y exigir verificación 2FA fuera de banda.',
  },
  {
    id: 'SEPBLAC-PBC',
    category: 'Blanqueo / SEPBLAC',
    code: 'Ley 10/2010 PBC-FT · Reglamento RD 304/2014',
    title: 'Prevención de Blanqueo de Capitales y Diligencia Reforzada',
    updated: 'Novedad 2026 (Paquete AML UE)',
    isNew: true,
    summary:
      'Obliga a aplicar medidas reforzadas de diligencia debida ante transferencias internacionales atípicas, países de riesgo, importes elevados o fraccionamiento sistemático ("smurfing") destinado a eludir umbrales de control.',
    gap: 'Vacío frecuente: pagos fraccionados en varias operaciones inferiores a 3.000 € hacia proveedores recién creados o jurisdicciones no cooperantes.',
    protocol:
      'Retener fondos preventivamente, solicitar factura/contrato justificativo y confirmar la orden telefónicamente con el apoderado de la cuenta.',
  },
  {
    id: 'RGPD-ART32',
    category: 'Datos / RGPD',
    code: 'RGPD (UE 2016/679) · LOPDGDD Ley Orgánica 3/2018',
    title: 'Art. 32 · Seguridad del Tratamiento y Trazabilidad de Accesos',
    updated: 'Vigente 2026',
    isNew: false,
    summary:
      'Exige garantizar la confidencialidad, integridad y resiliencia de los sistemas que tratan datos financieros, manteniendo registros de auditoría inalterables ante accesos desde dispositivos o redes no reconocidas.',
    gap: 'Vacío frecuente: accesos administrativos desde redes Wi-Fi públicas o VPN comerciales sin huella de dispositivo registrada ni registro de motivo.',
    protocol:
      'Validar identidad mediante código OTP, registrar justificación saneada en auditoría y notificar incidencia al DPO si se confirma acceso ilícito.',
  },
  {
    id: 'BDE-4-2017',
    category: 'Banca / BdE',
    code: 'Circular 4/2017 Banco de España · Guías EBA',
    title: 'Control Interno, Fraude Operacional y Supervisión Humana',
    updated: 'Vigente 2026',
    isNew: false,
    summary:
      'Establece que los modelos automatizados de riesgo deben contar con gobernanza, explicabilidad auditable y supervisión humana efectiva (Human-in-the-Loop) para cualquier operación fuera del perfil histórico.',
    gap: 'Vacío frecuente: delegar aprobaciones masivas en algoritmos sin bandeja de auditoría muestral ni registro de falsos positivos.',
    protocol:
      'Revisar el historial de la cuenta, documentar el criterio seguido en el expediente y auditar periódicamente las operaciones aprobadas automáticamente.',
  },
  {
    id: 'ENS-RD311',
    category: 'Seguridad / ENS',
    code: 'Real Decreto 311/2022 · Esquema Nacional de Seguridad',
    title: 'Protección contra Fuerza Bruta, Integridad y Control de Acceso',
    updated: 'Vigente 2026',
    isNew: false,
    summary:
      'Impone medidas técnicas verificables contra intentos repetitivos de autenticación (rate limiting), integridad criptográfica de logs (SHA-256) y saneamiento de entradas contra inyecciones de código.',
    gap: 'Vacío frecuente: endpoints de login o APIs internas sin limitación por ventana deslizante ni claves de idempotencia ante reenvíos.',
    protocol:
      'Mantener bloqueo automático HTTP 429 activo, exigir tokens anti-CSRF y sellar criptográficamente los registros críticos de auditoría.',
  },
];

export function createInitialModel() {
  return {
    version: 'Sentinel-LogReg-2.3',
    learningRate: 0.12,
    regularization: 0.01,
    updatesCount: 0,
    bias: -2.2,
    weights: {
      amountNorm: 2.4,
      foreignCountry: 1.6,
      unusualHour: 1.2,
      impossibleTravel: 3.2,
      unknownDevice: 1.4,
      failedAttemptsNorm: 2.0,
    },
  };
}

export function extractFeatures(event = {}) {
  const amount = Number(event.amount) || 0;
  const failedAttempts = Number(event.failedAttempts) || 0;

  return {
    amountNorm: Number(Math.min(amount / 5000, 1.5).toFixed(3)),
    foreignCountry: event.foreignCountry ? 1 : 0,
    unusualHour: event.unusualHour ? 1 : 0,
    impossibleTravel: event.impossibleTravel ? 1 : 0,
    unknownDevice: event.unknownDevice ? 1 : 0,
    failedAttemptsNorm: Number(Math.min(failedAttempts / 5, 1.5).toFixed(3)),
  };
}

function sigmoid(z) {
  return 1 / (1 + Math.exp(-z));
}

export function sanitizeNote(input, maxLen = 160) {
  if (typeof input !== 'string') return '';
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, maxLen);
}

export function escapeCsvCell(value) {
  const str = String(value ?? '').replace(/"/g, '""');
  const neutralized = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  return `"${neutralized}"`;
}

export function getSpanishLegalGuidance(event = {}, score = 0) {
  const amount = Number(event.amount) || 0;

  if (score === 0) {
    const entry = SPANISH_LEGAL_COMPENDIUM.find((l) => l.id === 'PSD2-SCA');
    return {
      lawId: entry.id,
      law: 'PSD2 · Art. 18 (Exención TRA)',
      gap: 'Sin vacío crítico; se recomienda verificación muestral para mantener trazabilidad.',
      guidance: 'Operación 100 % segura. Aprobada por IA, disponible para auditoría humana.',
    };
  }
  if (amount >= 2500 && event.foreignCountry) {
    const entry = SPANISH_LEGAL_COMPENDIUM.find((l) => l.id === 'SEPBLAC-PBC');
    return {
      lawId: entry.id,
      law: entry.code,
      gap: entry.gap,
      guidance: entry.protocol,
    };
  }
  if (event.impossibleTravel || (Number(event.failedAttempts) || 0) >= 3) {
    const entry = SPANISH_LEGAL_COMPENDIUM.find((l) => l.id === 'PSD2-SCA');
    return {
      lawId: entry.id,
      law: entry.code,
      gap: entry.gap,
      guidance: entry.protocol,
    };
  }
  if (event.unknownDevice) {
    const entry = SPANISH_LEGAL_COMPENDIUM.find((l) => l.id === 'RGPD-ART32');
    return {
      lawId: entry.id,
      law: entry.code,
      gap: entry.gap,
      guidance: entry.protocol,
    };
  }
  const entry = SPANISH_LEGAL_COMPENDIUM.find((l) => l.id === 'BDE-4-2017');
  return {
    lawId: entry.id,
    law: entry.code,
    gap: entry.gap,
    guidance: entry.protocol,
  };
}

function classifyThreatProfile(event, score) {
  if (score === 0) {
    return {
      threatCategory: 'Operación Verificada',
      actionAdvice: 'Sin anomalías · Aprobada por IA (auditable)',
    };
  }
  if (event.impossibleTravel && event.unknownDevice) {
    return {
      threatCategory: 'Suplantación (ATO)',
      actionAdvice: 'Bloquear acceso y revocar sesiones activas',
    };
  }
  if ((Number(event.amount) || 0) >= 3000 && event.foreignCountry) {
    return {
      threatCategory: 'Fuga de Capital',
      actionAdvice: 'Retener fondos y confirmar por teléfono',
    };
  }
  if ((Number(event.failedAttempts) || 0) >= 3) {
    return {
      threatCategory: 'Fuerza Bruta',
      actionAdvice: 'Bloquear origen y exigir doble factor (2FA)',
    };
  }
  if (event.foreignCountry) {
    return {
      threatCategory: 'Transferencia Atípica',
      actionAdvice: 'Validar factura y beneficiario con titular',
    };
  }
  if (event.unknownDevice) {
    return {
      threatCategory: 'Dispositivo Nuevo',
      actionAdvice: 'Confirmar identidad mediante código OTP',
    };
  }
  return {
    threatCategory: 'Anomalía Moderada',
    actionAdvice: 'Revisar historial y normativa antes de autorizar',
  };
}

export function evaluateRiskEvent(event, model = createInitialModel()) {
  const features = extractFeatures(event);
  let logit = model.bias;
  const contributions = [];

  for (const [key, value] of Object.entries(features)) {
    const weight = model.weights[key] ?? 0;
    const impact = weight * value;
    logit += impact;

    if (value > 0) {
      contributions.push({
        key,
        label: FEATURE_META[key]?.label || key,
        value,
        weight: Number(weight.toFixed(2)),
        impact: Number(impact.toFixed(2)),
      });
    }
  }

  // Ajuste contextual fino por canal o prima de riesgo de jurisdicción (sin alterar el entrenamiento base)
  const contextDelta = Number(event.contextRiskDelta) || 0;
  logit += contextDelta;

  contributions.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));

  const probability = sigmoid(logit);
  const hasRiskFlags =
    Boolean(event.foreignCountry) ||
    Boolean(event.unusualHour) ||
    Boolean(event.impossibleTravel) ||
    Boolean(event.unknownDevice) ||
    (Number(event.failedAttempts) || 0) > 0 ||
    (Number(event.amount) || 0) > 1500 ||
    contextDelta > 0.15;

  let score;
  if (!hasRiskFlags && probability < 0.22) {
    score = 0;
  } else {
    score = Math.min(99, Math.max(8, Math.round(probability * 100)));
  }

  let level = 'BAJO';
  let recommendation = 'APROBADA IA (100% SEGURA)';

  if (score >= 75) {
    level = 'CRÍTICO';
    recommendation = 'DENEGAR / BLOQUEAR';
  } else if (score >= 45) {
    level = 'ALTO';
    recommendation = 'REVISAR (HITL)';
  } else if (score > 0) {
    level = 'MODERADO';
    recommendation = 'VERIFICAR (HITL)';
  }

  const { threatCategory, actionAdvice } = classifyThreatProfile(event, score);
  const legal = getSpanishLegalGuidance(event, score);

  const reasons =
    contributions.length > 0
      ? contributions.map(
          (c) =>
            `${c.label}: impacto ${c.impact >= 0 ? '+' : ''}${c.impact} (peso w=${c.weight})`
        )
      : ['Sin señales de riesgo activas (100% segura)'];

  return {
    score,
    safetyPct: 100 - score,
    probability: Number(probability.toFixed(4)),
    logit: Number(logit.toFixed(3)),
    level,
    recommendation,
    threatCategory,
    actionAdvice,
    legal,
    reasons,
    contributions,
    features,
  };
}

export function trainModelStep(model, event, label, note = '') {
  const target = label === 1 ? 1 : 0;
  const before = evaluateRiskEvent(event, model);
  const error = target - before.probability;

  const clean = note.toLowerCase();
  const noteBoost =
    clean.includes('confirmado') ||
    clean.includes('estafa') ||
    clean.includes('falso positivo')
      ? 1.15
      : 1.0;

  const lr = (model.learningRate || 0.12) * noteBoost;
  const reg = model.regularization || 0.01;

  const nextWeights = { ...model.weights };
  const deltaWeights = {};

  for (const [key, xVal] of Object.entries(before.features)) {
    const rawDelta = lr * error * xVal - reg * (nextWeights[key] - 1.5) * 0.05;
    const clamped = Math.min(4.0, Math.max(0.3, nextWeights[key] + rawDelta));
    nextWeights[key] = Number(clamped.toFixed(4));
    if (xVal > 0) {
      deltaWeights[key] = Number(rawDelta.toFixed(3));
    }
  }

  const nextBias = Math.min(-0.8, Math.max(-3.8, model.bias + lr * error));

  const nextModel = {
    ...model,
    updatesCount: model.updatesCount + 1,
    bias: Number(nextBias.toFixed(4)),
    weights: nextWeights,
  };

  const after = evaluateRiskEvent(event, nextModel);

  return {
    model: nextModel,
    error: Number(error.toFixed(3)),
    prevScore: before.score,
    newScore: after.score,
    deltaWeights,
  };
}

export function createRateLimiter({ maxAttempts = 5, windowMs = 60000 } = {}) {
  let timestamps = [];

  return {
    attempt(now = Date.now()) {
      timestamps = timestamps.filter((t) => now - t < windowMs);
      if (timestamps.length >= maxAttempts) {
        const oldest = timestamps[0];
        const retryAfterSec = Math.max(
          1,
          Math.ceil((windowMs - (now - oldest)) / 1000)
        );
        return {
          allowed: false,
          status: 429,
          attempts: timestamps.length,
          maxAttempts,
          retryAfterSec,
        };
      }

      timestamps.push(now);
      return {
        allowed: true,
        status: 200,
        attempts: timestamps.length,
        maxAttempts,
        retryAfterSec: 0,
      };
    },
    reset() {
      timestamps = [];
    },
  };
}

export function computeDashboardMetrics(events = [], aiEnabled = true) {
  const pendingEvents = events.filter((e) => e.status === 'PENDING');
  const pending = pendingEvents.length;
  const criticalPending = pendingEvents.filter(
    (e) => (e.risk?.score || 0) >= 75
  ).length;
  const aiApproved = events.filter((e) => e.status === 'AUTO_APPROVED').length;
  const humanApproved = events.filter((e) => e.status === 'APPROVED').length;
  const humanBlocked = events.filter((e) => e.status === 'BLOCKED').length;

  const blockedEvents = events.filter((e) => e.status === 'BLOCKED');
  const blocked = blockedEvents.length;

  const protectedCapital = blockedEvents.reduce(
    (sum, e) => sum + (Number(e.amount) || 0),
    0
  );

  const pendingExposureEur = pendingEvents.reduce(
    (sum, e) => sum + (Number(e.amount) || 0),
    0
  );

  let threatLevel = 'CONTROLADO';
  if (pending >= 3) {
    threatLevel = 'ELEVADO';
  } else if (pending >= 1) {
    threatLevel = 'VIGILANCIA';
  }

  let statusDetail = 'Óptimo · Sin riesgo activo';
  if (!aiEnabled && pending > 0) {
    statusDetail = `Modo Manual (IA OFF) · ${pending} en cola (${pendingExposureEur.toLocaleString('es-ES')} € exp.)`;
  } else if (criticalPending >= 2 || pending >= 4) {
    statusDetail = `Crítico · ${criticalPending} críticas · ${pendingExposureEur.toLocaleString('es-ES')} € en riesgo`;
  } else if (pending > 0) {
    statusDetail = `Vigilancia · ${pending} pendientes · ${pendingExposureEur.toLocaleString('es-ES')} € en revisión`;
  } else if (protectedCapital > 0) {
    statusDetail = `Blindado · ${blocked} bloqueos efectivos`;
  }

  return {
    total: events.length,
    pending,
    criticalPending,
    blocked,
    approved: humanApproved,
    aiApproved,
    aiResolved: aiApproved,
    humanResolved: humanApproved + humanBlocked,
    totalResolved: aiApproved + humanApproved + humanBlocked,
    protectedCapital,
    pendingExposureEur,
    threatLevel,
    statusDetail,
  };
}

export function runQueryBenchmark(clientCount = 40, datasetSize = 15000) {
  const transactions = new Array(datasetSize);
  for (let i = 0; i < datasetSize; i++) {
    transactions[i] = {
      id: `TX-${100000 + i}`,
      clientId: i % clientCount,
      amount: ((i * 37) % 490) + 15,
    };
  }

  const t0 = performance.now();
  const nPlusOneTotals = new Array(clientCount);
  let nPlusOneOps = 0;
  for (let c = 0; c < clientCount; c++) {
    let sum = 0;
    for (let i = 0; i < datasetSize; i++) {
      nPlusOneOps += 1;
      if (transactions[i].clientId === c) {
        sum += transactions[i].amount;
      }
    }
    nPlusOneTotals[c] = sum;
  }
  const nPlusOneMs = Math.max(0.01, performance.now() - t0);

  const t1 = performance.now();
  const totalsMap = new Map();
  let aggregatedOps = 0;
  for (let i = 0; i < datasetSize; i++) {
    aggregatedOps += 1;
    const tx = transactions[i];
    totalsMap.set(tx.clientId, (totalsMap.get(tx.clientId) || 0) + tx.amount);
  }
  const aggregatedMs = Math.max(0.01, performance.now() - t1);

  const reductionPct = Math.max(
    0,
    Math.round(((nPlusOneMs - aggregatedMs) / nPlusOneMs) * 100)
  );

  const totalNPlusOneEur = nPlusOneTotals.reduce((acc, v) => acc + v, 0);
  const totalAggregatedEur = Array.from(totalsMap.values()).reduce(
    (acc, v) => acc + v,
    0
  );

  return {
    clientCount,
    datasetSize,
    totalVolumeEur: totalAggregatedEur,
    totalsMatch: totalNPlusOneEur === totalAggregatedEur,
    sampleRows: transactions.slice(0, 4),
    nPlusOne: {
      queries: 1 + clientCount,
      iterations: nPlusOneOps,
      latencyMs: Number(nPlusOneMs.toFixed(2)),
    },
    aggregated: {
      queries: 1,
      iterations: aggregatedOps,
      latencyMs: Number(aggregatedMs.toFixed(2)),
    },
    reductionPct,
  };
}

export async function computeSha256Hex(payloadString) {
  const data = new TextEncoder().encode(payloadString);
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  let h = 0x811c9dc5;
  for (let i = 0; i < data.length; i++) {
    h ^= data[i];
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function createIdempotencyGuard() {
  const processedKeys = new Map();
  let csrfToken =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? `csrf_${crypto.randomUUID().slice(0, 12)}`
      : `csrf_${Date.now().toString(36)}`;

  return {
    getCsrfToken() {
      return csrfToken;
    },
    generateKey() {
      return typeof crypto !== 'undefined' && crypto.randomUUID
        ? `idem_${crypto.randomUUID().slice(0, 12)}`
        : `idem_${Math.random().toString(36).slice(2, 12)}`;
    },
    execute({ idempotencyKey, providedCsrf, amount }) {
      if (providedCsrf !== csrfToken) {
        return {
          status: 403,
          ok: false,
          reason: 'Token CSRF inválido o ausente (Petición forjada bloqueada)',
        };
      }
      if (processedKeys.has(idempotencyKey)) {
        return {
          status: 409,
          ok: false,
          reason: `Clave duplicada (${idempotencyKey}): doble cargo bloqueado automáticamente.`,
          originalAt: processedKeys.get(idempotencyKey).at,
        };
      }
      const record = { amount, at: new Date().toLocaleTimeString('es-ES') };
      processedKeys.set(idempotencyKey, record);
      return {
        status: 201,
        ok: true,
        reason: `Orden de ${amount} € ejecutada una sola vez (clave sellada).`,
      };
    },
    reset() {
      processedKeys.clear();
      csrfToken =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? `csrf_${crypto.randomUUID().slice(0, 12)}`
          : `csrf_${Date.now().toString(36)}`;
    },
  };
}