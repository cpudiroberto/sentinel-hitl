import { describe, expect, it } from 'vitest';
import {
  computeDashboardMetrics,
  createInitialModel,
  createRateLimiter,
  evaluateRiskEvent,
  runQueryBenchmark,
  sanitizeNote,
  trainModelStep,
} from './securityEngine';

describe('Sentinel HITL - Security & Online ML Engine', () => {
  it('sanea etiquetas HTML y respeta el límite máximo de caracteres', () => {
    const dirty = '  <script>alert(1)</script> Bloqueo verificado por teléfono  ';
    expect(sanitizeNote(dirty, 25)).toBe('alert(1) Bloqueo verifica');
  });

  it('clasifica como CRÍTICO una transferencia internacional de alto importe', () => {
    const res = evaluateRiskEvent({
      amount: 4850,
      foreignCountry: true,
      unusualHour: true,
    });
    expect(res.level).toBe('CRÍTICO');
    expect(res.score).toBeGreaterThanOrEqual(75);
    expect(res.contributions.length).toBeGreaterThanOrEqual(3);
  });

  it('aprende en vivo (Online Gradient Descent) ajustando pesos tras feedback HITL', () => {
    const model0 = createInitialModel();
    const sample = { amount: 1650, foreignCountry: true, unusualHour: false };

    // Si el operador APRUEBA (label = 0), la probabilidad de riesgo debe bajar
    const afterApprove = trainModelStep(model0, sample, 0);
    expect(afterApprove.model.updatesCount).toBe(1);
    expect(afterApprove.newScore).toBeLessThan(afterApprove.prevScore);
    expect(afterApprove.model.weights.foreignCountry).toBeLessThan(
      model0.weights.foreignCountry
    );

    // Si el operador BLOQUEA (label = 1), la probabilidad de riesgo debe subir
    const afterBlock = trainModelStep(model0, sample, 1);
    expect(afterBlock.newScore).toBeGreaterThan(afterBlock.prevScore);
    expect(afterBlock.model.weights.foreignCountry).toBeGreaterThan(
      model0.weights.foreignCountry
    );
  });

  it('bloquea con HTTP 429 al superar 5 intentos por minuto y se recupera', () => {
    const limiter = createRateLimiter({ maxAttempts: 5, windowMs: 60000 });
    const t0 = 1_000_000;

    for (let i = 0; i < 5; i++) {
      expect(limiter.attempt(t0 + i * 1000).status).toBe(200);
    }

    const blocked = limiter.attempt(t0 + 6000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.status).toBe(429);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);

    const recovered = limiter.attempt(t0 + 61000);
    expect(recovered.allowed).toBe(true);
    expect(recovered.status).toBe(200);
  });

  it('calcula métricas consistentes desde una única fuente de verdad', () => {
    const metrics = computeDashboardMetrics([
      { status: 'PENDING', amount: 1000 },
      { status: 'BLOCKED', amount: 4850 },
      { status: 'APPROVED', amount: 300 },
    ]);
    expect(metrics.pending).toBe(1);
    expect(metrics.blocked).toBe(1);
    expect(metrics.protectedCapital).toBe(4850);
    expect(metrics.threatLevel).toBe('VIGILANCIA');
  });

  it('demuestra una reducción de latencia superior al 70% al eliminar N+1', () => {
    const bench = runQueryBenchmark(40);
    expect(bench.aggregated.queries).toBe(1);
    expect(bench.nPlusOne.queries).toBe(41);
    expect(bench.reductionPct).toBeGreaterThanOrEqual(70);
  });
});