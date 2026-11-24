import { useMemo, useState } from 'react';
import { SPANISH_LEGAL_COMPENDIUM } from '../engine/securityEngine';
import { playTone } from '../utils/audioEngine';
import { EventBadges } from './BrandAssets';
import { TOUR_STEPS } from '../utils/tourSteps';

export function GuidedTourCard({ tourStep, tourPos, onChangeStep, onClose }) {
  if (tourStep === null) return null;
  const current = TOUR_STEPS[tourStep];
  const isLast = tourStep === TOUR_STEPS.length - 1;

  return (
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
        {!isLast && (
          <button
            className="tour-close-btn"
            onClick={() => {
              playTone('click');
              onClose();
            }}
          >
            Cerrar guía
          </button>
        )}
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
        {current.title}
      </h3>
      <p
        style={{
          margin: '0 0 1.25rem',
          fontSize: '0.96rem',
          color: 'var(--text-muted)',
        }}
      >
        {current.body}
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
            onChangeStep(Math.max(0, tourStep - 1));
          }}
        >
          ← Anterior
        </button>
        {!isLast ? (
          <button
            className="btn-primary"
            onClick={() => {
              playTone('click');
              onChangeStep(tourStep + 1);
            }}
          >
            Continuar (Paso {tourStep + 2} de {TOUR_STEPS.length}) →
          </button>
        ) : (
          <button
            className="btn-success"
            onClick={() => {
              playTone('approve');
              onClose();
            }}
          >
            Finalizar guía ✓
          </button>
        )}
      </div>
    </aside>
  );
}

export function LegalCompendiumModal({
  open,
  initialQuery,
  onClose,
}) {
  const [search, setSearch] = useState(initialQuery || '');
  const [category, setCategory] = useState('Todas');
  const [copiedId, setCopiedId] = useState(null);

  const filteredLaws = useMemo(() => {
    const q = search.trim().toLowerCase();
    return SPANISH_LEGAL_COMPENDIUM.filter((law) => {
      const matchCat = category === 'Todas' || law.category === category;
      const matchText =
        !q ||
        law.code.toLowerCase().includes(q) ||
        law.title.toLowerCase().includes(q) ||
        law.summary.toLowerCase().includes(q) ||
        law.gap.toLowerCase().includes(q) ||
        law.protocol.toLowerCase().includes(q);
      return matchCat && matchText;
    });
  }, [search, category]);

  if (!open) return null;

  const handleCopy = async (law) => {
    const text = `${law.code} — ${law.title}\nResumen: ${law.summary}\nVacío / Riesgo: ${law.gap}\nProtocolo del agente: ${law.protocol}`;
    try {
      await navigator.clipboard.writeText(text);
      playTone('verify');
      setCopiedId(law.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback silencioso
    }
  };

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="modal-panel modal-wide animate-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '0.8rem',
          }}
        >
          <div>
            <span className="badge badge-ai">
              Compendio Normativo España · Edición 2026
            </span>
            <h3 style={{ margin: '0.35rem 0 0', fontSize: '1.28rem' }}>
              Buscador de Normativa Bancaria y Seguridad
            </h3>
          </div>
          <button className="btn-secondary" onClick={onClose}>
            Cerrar
          </button>
        </div>

        <input
          className="xss-input"
          placeholder="Buscar por ley, artículo, vacío legal o protocolo (ej. PSD2, SEPBLAC, 2FA, RGPD)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ marginBottom: '0.85rem' }}
        />

        <div className="inline-controls" style={{ marginBottom: '1rem' }}>
          {[
            'Todas',
            'Pagos / PSD2',
            'Blanqueo / SEPBLAC',
            'Datos / RGPD',
            'Banca / BdE',
            'Seguridad / ENS',
          ].map((cat) => (
            <button
              key={cat}
              className={category === cat ? 'btn-primary' : 'btn-secondary'}
              style={{ padding: '0.36rem 0.75rem', fontSize: '0.8rem' }}
              onClick={() => {
                playTone('click');
                setCategory(cat);
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {filteredLaws.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>
            No se encontraron disposiciones que coincidan con tu búsqueda.
          </p>
        ) : (
          filteredLaws.map((law) => (
            <article key={law.id} className="law-card">
              <div className="lab-footer-row" style={{ marginBottom: '0.4rem' }}>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <span className="badge badge-ai">{law.category}</span>
                  <span
                    className={`badge ${law.isNew ? 'badge-high' : 'badge-neutral'}`}
                  >
                    {law.updated}
                  </span>
                </div>
                <button
                  className="btn-secondary"
                  style={{ padding: '0.32rem 0.72rem', fontSize: '0.78rem' }}
                  onClick={() => handleCopy(law)}
                >
                  {copiedId === law.id ? '¡Copiado! ✓' : 'Copiar texto'}
                </button>
              </div>
              <strong style={{ display: 'block', fontSize: '1.02rem' }}>
                {law.code} · {law.title}
              </strong>
              <p
                style={{
                  margin: '0.35rem 0',
                  fontSize: '0.88rem',
                  color: 'var(--text-muted)',
                }}
              >
                {law.summary}
              </p>
              <div style={{ fontSize: '0.86rem', marginBottom: '0.25rem' }}>
                <strong style={{ color: 'var(--warning)' }}>
                  Posible vacío legal:
                </strong>{' '}
                {law.gap}
              </div>
              <div style={{ fontSize: '0.86rem' }}>
                <strong style={{ color: 'var(--success)' }}>
                  Protocolo del agente:
                </strong>{' '}
                {law.protocol}
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

export function HitlDecisionModal({
  event,
  noteInput,
  onChangeNote,
  isResolving,
  onClose,
  onResolve,
  onOpenLaw,
}) {
  if (!event) return null;

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="modal-panel animate-in"
        onClick={(e) => e.stopPropagation()}
      >
        <EventBadges evt={event} />

        <h3 style={{ margin: '0.2rem 0 0.3rem', fontSize: '1.25rem' }}>
          {event.title}
          {event.amount > 0
            ? ` (${event.amount.toLocaleString('es-ES')} €)`
            : ''}
        </h3>
        <p
          style={{
            margin: '0 0 0.95rem',
            fontSize: '0.9rem',
            color: 'var(--text-muted)',
          }}
        >
          {event.account} · {event.location} · {event.channel || 'Web'} · IP{' '}
          <span className="mono">{event.ip || '-'}</span> ·{' '}
          <span className="mono">{event.timestamp}</span>
        </p>

        <div className="modal-ai-box">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '0.35rem',
            }}
          >
            <strong style={{ color: '#7dd3fc' }}>{event.risk.legal?.law}</strong>
            <button
              className="legal-trigger-btn"
              style={{ padding: '0.2rem 0.55rem', fontSize: '0.74rem' }}
              onClick={() =>
                onOpenLaw(event.risk.legal?.law.split(' ')[0] || '')
              }
            >
              Ver ley ↗
            </button>
          </div>
          <div style={{ color: '#cbd5e1', marginBottom: '0.35rem' }}>
            <strong>Vacío / Riesgo:</strong> {event.risk.legal?.gap}
          </div>
          <div style={{ color: '#6ee7b7' }}>
            <strong>Recomendación:</strong> {event.risk.legal?.guidance}
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
          onChange={(e) => onChangeNote(e.target.value)}
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
          <button className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn-success"
            disabled={isResolving}
            onClick={() => onResolve('APPROVED')}
          >
            Aprobar operación
          </button>
          <button
            className="btn-danger"
            disabled={isResolving}
            onClick={() => onResolve('BLOCKED')}
          >
            Denegar / Bloquear
          </button>
        </div>
      </div>
    </div>
  );
}