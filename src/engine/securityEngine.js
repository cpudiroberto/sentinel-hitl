export function sanitizeNote(input, maxLength = 160) {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export function evaluateRiskEvent(event) {
  let score = 15;
  const reasons = [];

  if (event.type === 'FINANCIAL') {
    if (event.amount >= 3000) {
      score += 40;
      reasons.push(`Importe inusual (${event.amount.toLocaleString('es-ES')} €)`);
    } else if (event.amount >= 1000) {
      score += 20;
      reasons.push(`Importe elevado (${event.amount.toLocaleString('es-ES')} €)`);
    }
    if (event.foreignCountry) {
      score += 25;
      reasons.push(`Destino internacional (${event.location})`);
    }
    if (event.unusualHour) {
      score += 15;
      reasons.push('Operación fuera de horario habitual');
    }
  } else if (event.type === 'ACCESS') {
    if (event.impossibleTravel) {
      score += 45;
      reasons.push(`Viaje imposible detectado (${event.location})`);
    }
    if (event.unknownDevice) {
      score += 25;
      reasons.push('Dispositivo no reconocido');
    }
    if (event.failedAttempts >= 3) {
      score += 20;
      reasons.push(`${event.failedAttempts} intentos fallidos previos`);
    }
  }

  const finalScore = Math.min(100, score);
  const level =
    finalScore >= 75 ? 'CRÍTICO' : finalScore >= 45 ? 'ALTO' : 'MEDIO';
  const recommendation =
    finalScore >= 75
      ? 'Bloquear preventivamente y exigir verificación'
      : 'Solicitar confirmación manual del operador';

  return { score: finalScore, level, recommendation, reasons };
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

export function computeDashboardMetrics(events) {
  const pending = events.filter((e) => e.status === 'PENDING').length;
  const blocked = events.filter((e) => e.status === 'BLOCKED').length;
  const approved = events.filter((e) => e.status === 'APPROVED').length;
  const protectedCapital = events
    .filter((e) => e.status === 'BLOCKED' && e.type === 'FINANCIAL')
    .reduce((acc, e) => acc + (e.amount || 0), 0);

  const threatLevel =
    pending >= 3 ? 'ELEVADO' : pending >= 1 ? 'VIGILANCIA' : 'ESTABLE';

  return { pending, blocked, approved, protectedCapital, threatLevel };
}

export function runQueryBenchmark(clientCount = 40) {
  const nPlusOneQueries = 1 + clientCount;
  const nPlusOneMs = 40 + clientCount * 20;
  const aggregatedQueries = 1;
  const aggregatedMs = 185;
  const reductionPct = Math.round(
    ((nPlusOneMs - aggregatedMs) / nPlusOneMs) * 100
  );

  return {
    clientCount,
    nPlusOne: { queries: nPlusOneQueries, latencyMs: nPlusOneMs },
    aggregated: { queries: aggregatedQueries, latencyMs: aggregatedMs },
    reductionPct,
  };
}