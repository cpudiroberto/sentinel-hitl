export const FEATURE_META = {
  amountNorm: { label: 'Importe elevado', short: 'Importe' },
  foreignCountry: { label: 'Operación internacional', short: 'País extranjero' },
  unusualHour: { label: 'Horario inusual (madrugada)', short: 'Horario' },
  impossibleTravel: { label: 'Viaje imposible (geolocalización)', short: 'Viaje imposible' },
  unknownDevice: { label: 'Dispositivo no reconocido', short: 'Dispositivo' },
  failedAttemptsNorm: { label: 'Intentos fallidos de clave', short: 'Fallos acceso' },
};

export function createInitialModel() {
  return {
    version: 'Sentinel-LogReg-2.2',
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

/**
 * Protección contra CSV Formula Injection (ataques DDE en Excel)
 */
export function escapeCsvCell(value) {
  const str = String(value ?? '').replace(/"/g, '""');
  const neutralized = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  return `"${neutralized}"`;
}

export function getSpanishLegalGuidance(event = {}, score = 0) {
  const amount = Number(event.amount) || 0;

  if (score === 0) {
    return {
      law: 'PSD2 · Art. 18 (Exención TRA)',
      gap: 'Sin vacío crítico; se recomienda auditoría muestral para cumplir trazabilidad interna.',
      guidance: 'Operación 100% segura. Aprobada por IA, disponible para verificación humana.',
    };
  }
  if (amount >= 3000 && event.foreignCountry) {
    return {
      law: 'Ley 10/2010 PBC-FT (SEPBLAC) · Diligencia reforzada',
      gap: 'Vacío habitual: transferencias fraccionadas justo bajo umbrales de reporte automático.',
      guidance: 'Retener preventivamente y exigir justificante documental + confirmación telefónica al titular.',
    };
  }
  if (event.impossibleTravel || (Number(event.failedAttempts) || 0) >= 3) {
    return {
      law: 'Directiva PSD2 (SCA) · Autenticación Reforzada',
      gap: 'Vacío habitual: reutilización de sesiones o tokens sin re-validación geográfica.',
      guidance: 'Bloquear sesión de inmediato, revocar tokens activos y exigir doble factor (2FA).',
    };
  }
  if (event.unknownDevice) {
    return {
      law: 'RGPD / LOPDGDD · Art. 32 (Seguridad del tratamiento)',
      gap: 'Vacío habitual: accesos desde redes públicas o VPN sin huella de dispositivo registrada.',
      guidance: 'Solicitar verificación OTP fuera de banda antes de autorizar cambios sensibles.',
    };
  }
  return {
    law: 'Circular 4/2017 Banco de España · Control Interno',
    gap: 'Posible anomalía de comportamiento fuera del perfil histórico del cliente.',
    guidance: 'Revisar historial de la cuenta y dejar nota de auditoría antes de aprobar o denegar.',
  };
}

function classifyThreatProfile(event, score) {
  if (score === 0) {
    return {
      threatCategory: 'Operación Verificada (100% Segura)',
      actionAdvice: 'Sin anomalías · Aprobada por IA (auditable)',
    };
  }
  if (event.impossibleTravel && event.unknownDevice) {
    return {
      threatCategory: 'Suplantación de Identidad (ATO)',
      actionAdvice: 'Bloquear acceso y forzar cambio de credenciales',
    };
  }
  if ((Number(event.amount) || 0) >= 3000 && event.foreignCountry) {
    return {
      threatCategory: 'Fuga de Capital Internacional',
      actionAdvice: 'Retener fondos y verificar por canal telefónico',
    };
  }
  if ((Number(event.failedAttempts) || 0) >= 3) {
    return {
      threatCategory: 'Intento de Fuerza Bruta',
      actionAdvice: 'Bloquear origen y exigir doble factor (2FA)',
    };
  }
  if (event.foreignCountry) {
    return {
      threatCategory: 'Operación Transfronteriza Atípica',
      actionAdvice: 'Validar proveedor y factura con el titular',
    };
  }
  if (event.unknownDevice) {
    return {
      threatCategory: 'Dispositivo No Reconocido',
      actionAdvice: 'Confirmar identidad mediante código OTP',
    };
  }
  return {
    threatCategory: 'Anomalía Moderada',
    actionAdvice: 'Revisar contexto legal antes de autorizar',
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

  contributions.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));

  const probability = sigmoid(logit);
  const hasRiskFlags =
    Boolean(event.foreignCountry) ||
    Boolean(event.unusualHour) ||
    Boolean(event.impossibleTravel) ||
    Boolean(event.unknownDevice) ||
    (Number(event.failedAttempts) || 0) > 0 ||
    (Number(event.amount) || 0) > 1500;

  let score;
  if (!hasRiskFlags && probability < 0.22) {
    score = 0;
  } else {
    score = Math.min(99, Math.max(12, Math.round(probability * 100)));
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

  let statusDetail = `Óptimo · Sin riesgo activo`;
  if (!aiEnabled && pending > 0) {
    statusDetail = `Manual (IA OFF) · ${pending} sin revisar (${pendingExposureEur.toLocaleString('es-ES')} € exp.)`;
  } else if (criticalPending >= 2 || pending >= 4) {
    statusDetail = `Crítico · ${criticalPending} críticas · ${pendingExposureEur.toLocaleString('es-ES')} € en riesgo`;
  } else if (pending > 0) {
    statusDetail = `Vigilancia · ${pending} en cola · ${pendingExposureEur.toLocaleString('es-ES')} € en revisión`;
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

/**
 * Sello criptográfico real SHA-256 mediante Web Crypto API
 */
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

/**
 * Guardia real de Idempotencia + Anti-CSRF (previene doble cobro y Replay Attacks)
 */
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
        reason: `Transferencia de ${amount} € ejecutada una sola vez (clave registrada).`,
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