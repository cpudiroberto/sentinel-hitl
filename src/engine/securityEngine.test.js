import { describe, it, expect } from 'vitest';
import {
  sanitizeNote,
  evaluateRiskEvent,
  createRateLimiter,
  computeDashboardMetrics,
  runQueryBenchmark,
} from './securityEngine';

describe('Sentinel HITL - Security Engine', () => {
  it('sanea etiquetas HTML y respeta el límite máximo de caracteres', () => {
    const dirty = '  <script>alert(1)</script> Revisado   por operador  ';
    expect(sanitizeNote(dirty, 30)).toBe('scriptalert(1)/script Revisado');
  });

  it('clasifica como CRÍTICO una transferencia internacional de alto importe', () => {
    const result = evaluateRiskEvent({
      type: 'FINANCIAL',
      amount: 4800,
      foreignCountry: true,
      location: 'Singapur',
      unusualHour: true,
    });
    expect(result.level).toBe('CRÍTICO');
    expect(result.score).toBeGreaterThanOrEqual(75);
  });

  it('bloquea con HTTP 429 al superar 5 intentos por minuto y se recupera', () => {
    const limiter = createRateLimiter({ maxAttempts: 5, windowMs: 60000 });
    const start = 100000;
    for (let i = 0; i < 5; i++) {
      expect(limiter.attempt(start + i * 1000).status).toBe(200);
    }
    const blocked = limiter.attempt(start + 6000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.status).toBe(429);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);

    const recovered = limiter.attempt(start + 61000);
    expect(recovered.allowed).toBe(true);
    expect(recovered.status).toBe(200);
  });

  it('calcula métricas consistentes desde una única fuente de verdad', () => {
    const metrics = computeDashboardMetrics([
      { id: 1, type: 'FINANCIAL', amount: 3200, status: 'BLOCKED' },
      { id: 2, type: 'ACCESS', status: 'PENDING' },
      { id: 3, type: 'FINANCIAL', amount: 500, status: 'APPROVED' },
    ]);
    expect(metrics.protectedCapital).toBe(3200);
    expect(metrics.pending).toBe(1);
    expect(metrics.blocked).toBe(1);
  });

  it('demuestra una reducción de latencia superior al 70% al eliminar N+1', () => {
    const bench = runQueryBenchmark(40);
    expect(bench.nPlusOne.queries).toBe(41);
    expect(bench.aggregated.queries).toBe(1);
    expect(bench.reductionPct).toBeGreaterThan(70);
  });
});