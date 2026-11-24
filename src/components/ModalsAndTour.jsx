import { useMemo, useState } from 'react';
import { playTone } from '../utils/audioEngine';
import { CaseTelemetryHeader } from './BrandAssets';
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
      <div className="lab-footer-row">
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
      <p className="tour-body-text">{current.body}</p>

      <div className="lab-footer-row">
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

/**
 * Biblioteca Normativa de España estructurada como un libro:
 * Columna izquierda = Índice por Capítulos + Buscador
 * Columna derecha = Página de lectura del capítulo + Enlace oficial BOE + Copiar
 */
export function LegalCompendiumModal({
  open,
  chapters,
  syncedAt,
  isSyncing,
  initialQuery,
  onRefresh,
  onClose,
}) {
  const [search, setSearch] = useState(initialQuery || '');
  const [selectedId, setSelectedId] = useState(() => {
    if (initialQuery) {
      const q = initialQuery.toLowerCase();
      const match = chapters.find(
        (c) =>
          c.code.toLowerCase().includes(q) ||
          c.category.toLowerCase().includes(q) ||
          c.title.toLowerCase().includes(q)
      );
      if (match) return match.id;
    }
    return chapters[0]?.id || '';
  });
  const [copiedId, setCopiedId] = useState(null);

  const filteredChapters = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return chapters;
    return chapters.filter(
      (law) =>
        law.chapter.toLowerCase().includes(q) ||
        law.category.toLowerCase().includes(q) ||
        law.code.toLowerCase().includes(q) ||
        law.title.toLowerCase().includes(q) ||
        law.summary.toLowerCase().includes(q) ||
        law.gap.toLowerCase().includes(q) ||
        law.protocol.toLowerCase().includes(q)
    );
  }, [chapters, search]);

  if (!open) return null;

  const activeLaw =
    filteredChapters.find((c) => c.id === selectedId) ||
    filteredChapters[0] ||
    null;

  const handleCopy = async (law) => {
    const text = `${law.chapter} · ${law.code} (${law.boeId || 'BOE'})\n${law.title}\nResumen: ${law.summary}\nVacío / Riesgo: ${law.gap}\nProtocolo del agente: ${law.protocol}\nFuente oficial: ${law.boeUrl || 'https://www.boe.es'}`;
    try {
      await navigator.clipboard.writeText(text);
      playTone('verify');
      setCopiedId(law.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Silencio seguro
    }
  };

  const formattedSync = syncedAt
    ? new Date(syncedAt).toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Compendio local verificado';

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="modal-panel modal-book animate-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="book-topbar">
          <div>
            <div className="editorial-kicker mono">
              BIBLIOTECA NORMATIVA DE ESPAÑA · FUENTE BOE.ES
            </div>
            <h3 style={{ margin: '0.15rem 0 0', fontSize: '1.3rem' }}>
              Compendio Legal Bancario y de Seguridad
            </h3>
            <div className="book-sync-meta mono">
              Última sincronización: {formattedSync}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              className="btn-secondary"
              disabled={isSyncing}
              onClick={() => {
                playTone('verify');
                onRefresh();
              }}
            >
              {isSyncing ? 'Comprobando...' : 'Sincronizar ahora'}
            </button>
            <button className="btn-secondary" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </div>

        <input
          className="xss-input"
          placeholder="Buscar capítulo, ley, artículo o protocolo (ej. PSD2, SEPBLAC, 2FA, RGPD, ENS)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ marginBottom: '1rem' }}
        />

        <div className="book-layout">
          {/* Columna izquierda: Índice de capítulos como un libro */}
          <aside className="book-toc" aria-label="Índice por capítulos">
            <div className="book-toc-header mono">ÍNDICE POR TEMAS</div>
            {filteredChapters.length === 0 ? (
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                Sin capítulos coincidentes.
              </p>
            ) : (
              filteredChapters.map((ch) => (
                <button
                  key={ch.id}
                  className={`book-toc-item ${
                    activeLaw?.id === ch.id ? 'active' : ''
                  }`}
                  onClick={() => {
                    playTone('click');
                    setSelectedId(ch.id);
                  }}
                >
                  <span className="book-toc-num mono">{ch.chapter}</span>
                  <span className="book-toc-text">
                    <strong>{ch.category}</strong>
                    <small className="mono">{ch.code}</small>
                  </span>
                </button>
              ))
            )}
          </aside>

          {/* Columna derecha: Página de lectura */}
          <div className="book-page">
            {activeLaw ? (
              <>
                <div className="book-page-head">
                  <span className="mono" style={{ color: 'var(--accent)', fontSize: '0.8rem', fontWeight: 700 }}>
                    {activeLaw.chapter} · {activeLaw.boeId || 'BOE'} · {activeLaw.status || 'Vigente'}
                  </span>
                  <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                    {activeLaw.boeUrl && (
                      <a
                        href={activeLaw.boeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-link btn-secondary"
                        style={{ padding: '0.32rem 0.7rem', fontSize: '0.78rem' }}
                      >
                        Abrir en BOE.es ↗
                      </a>
                    )}
                    <button
                      className="btn-primary"
                      style={{ padding: '0.32rem 0.75rem', fontSize: '0.78rem' }}
                      onClick={() => handleCopy(activeLaw)}
                    >
                      {copiedId === activeLaw.id ? '¡Copiado! ✓' : 'Copiar artículo'}
                    </button>
                  </div>
                </div>

                <h4 className="book-page-title">{activeLaw.title}</h4>
                <div className="book-page-meta mono">
                  Norma: {activeLaw.code} · Consolidación BOE:{' '}
                  {activeLaw.lastConsolidated || 'Vigente'}
                </div>

                <div className="book-section">
                  <h5>1. Objeto y alcance normativo</h5>
                  <p>{activeLaw.summary}</p>
                </div>

                <div className="book-section book-section-warn">
                  <h5>2. Posible vacío legal o vector de riesgo</h5>
                  <p>{activeLaw.gap}</p>
                </div>

                <div className="book-section book-section-ok">
                  <h5>3. Protocolo recomendado para el agente</h5>
                  <p>{activeLaw.protocol}</p>
                </div>
              </>
            ) : (
              <p style={{ color: 'var(--text-muted)' }}>
                No se encontraron capítulos que coincidan con «{search}».
              </p>
            )}
          </div>
        </div>
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
        <CaseTelemetryHeader evt={event} />

        <h3 style={{ margin: '0.25rem 0 0.3rem', fontSize: '1.25rem' }}>
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
          <div className="lab-footer-row" style={{ marginBottom: '0.35rem' }}>
            <strong style={{ color: '#7dd3fc' }}>{event.risk.legal?.law}</strong>
            <button
              className="legal-trigger-btn"
              style={{ padding: '0.2rem 0.55rem', fontSize: '0.74rem' }}
              onClick={() =>
                onOpenLaw(event.risk.legal?.law.split(' ')[0] || '')
              }
            >
              Ver en biblioteca ↗
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
            Aprobar caso
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