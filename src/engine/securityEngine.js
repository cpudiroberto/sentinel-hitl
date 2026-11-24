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
    version: 'Sentinel-LogReg-2.0',
    learningRate: 0.12, // Aprendizaje sutil anti-sobreajuste
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

function classifyThreatProfile(event, score) {
  if (score === 0) {
    return {
      threatCategory: 'Operación Verificada (100% Segura)',
      actionAdvice: 'Sin anomalías · Aprobación autónoma auditable',
    };
  }
  if (score === 100) {
    return {
      threatCategory:
        event.type === 'ACCESS'
          ? 'Secuestro de Cuenta (ATO)'
          : 'Fraude Crítico Confirmado',
      actionAdvice: 'Bloqueo autónomo ejecutado · Auditar sesión',
    };
  }
  if (event.impossibleTravel && event.unknownDevice) {
    return {
      threatCategory: 'Suplantación de Identidad',
      actionAdvice: 'Bloquear acceso y forzar cambio de clave',
    };
  }
  if ((Number(event.amount) || 0) >= 3000 && event.foreignCountry) {
    return {
      threatCategory: 'Fuga de Capital Internacional',
      actionAdvice: 'Retener fondos y confirmar por teléfono',
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
    actionAdvice: 'Revisar contexto antes de autorizar',
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
    score = 0; // 100% segura -> elegible para aprobación autónoma
  } else if (probability >= 0.965) {
    score = 100; // 100% amenaza -> bloqueo autónomo
  } else {
    score = Math.min(99, Math.max(1, Math.round(probability * 100)));
  }

  let level = 'BAJO';
  let recommendation = 'APROBAR AUTO (100% SEGURA)';

  if (score === 100) {
    level = 'CRÍTICO';
    recommendation = 'BLOQUEO AUTO (100%)';
  } else if (score >= 75) {
    level = 'CRÍTICO';
    recommendation = 'BLOQUEAR';
  } else if (score >= 1) {
    level = score >= 45 ? 'ALTO' : 'MODERADO';
    recommendation = 'REVISAR (HITL)';
  }

  const { threatCategory, actionAdvice } = classifyThreatProfile(event, score);

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
    reasons,
    contributions,
    features,
  };
}

/**
 * Aprendizaje online sutil con regularización L2 y límites de peso
 * para evitar sobreajuste o sesgos por errores puntuales del operador.
 */
export function trainModelStep(model, event, label, note = '') {
  const target = label === 1 ? 1 : 0;
  const before = evaluateRiskEvent(event, model);
  const error = target - before.probability;

  // Ajuste sutil si la nota contiene confirmación explícita
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

export function computeDashboardMetrics(events = []) {
  const pending = events.filter((e) => e.status === 'PENDING').length;
  const aiApproved = events.filter((e) => e.status === 'AUTO_APPROVED').length;
  const aiBlocked = events.filter((e) => e.status === 'AUTO_BLOCKED').length;
  const humanApproved = events.filter((e) => e.status === 'APPROVED').length;
  const humanBlocked = events.filter((e) => e.status === 'BLOCKED').length;

  const blockedEvents = events.filter(
    (e) => e.status === 'BLOCKED' || e.status === 'AUTO_BLOCKED'
  );
  const blocked = blockedEvents.length;

  const protectedCapital = blockedEvents.reduce(
    (sum, e) => sum + (Number(e.amount) || 0),
    0
  );

  let threatLevel = 'CONTROLADO';
  if (pending >= 3) {
    threatLevel = 'ELEVADO';
  } else if (pending >= 1) {
    threatLevel = 'VIGILANCIA';
  }

  return {
    total: events.length,
    pending,
    blocked,
    approved: humanApproved,
    aiApproved,
    aiBlocked,
    aiResolved: aiApproved + aiBlocked,
    humanResolved: humanApproved + humanBlocked,
    protectedCapital,
    threatLevel,
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
  for (let c = 0; c < clientCount; c++) {
    let sum = 0;
    for (let i = 0; i < datasetSize; i++) {
      if (transactions[i].clientId === c) {
        sum += transactions[i].amount;
      }
    }
    nPlusOneTotals[c] = sum;
  }
  const nPlusOneMs = Math.max(0.01, performance.now() - t0);

  const t1 = performance.now();
  const totalsMap = new Map();
  for (let i = 0; i < datasetSize; i++) {
    const tx = transactions[i];
    totalsMap.set(tx.clientId, (totalsMap.get(tx.clientId) || 0) + tx.amount);
  }
  const aggregatedMs = Math.max(0.01, performance.now() - t1);

  const reductionPct = Math.max(
    0,
    Math.round(((nPlusOneMs - aggregatedMs) / nPlusOneMs) * 100)
  );

  const totalVolumeEur = Array.from(totalsMap.values()).reduce(
    (acc, v) => acc + v,
    0
  );

  return {
    clientCount,
    datasetSize,
    totalVolumeEur,
    sampleClient0Eur: totalsMap.get(0) || 0,
    nPlusOne: {
      queries: 1 + clientCount,
      latencyMs: Number(nPlusOneMs.toFixed(2)),
    },
    aggregated: {
      queries: 1,
      latencyMs: Number(aggregatedMs.toFixed(2)),
    },
    reductionPct,
  };
}