import {
  GITHUB_PROFILE_URL,
  LINKEDIN_URL,
  downloadPortfolioDossier,
} from '../utils/exporters';
import { playTone } from '../utils/audioEngine';

const STACK_BADGES = [
  'React 19',
  'Vite 6',
  'Vitest TDD (6/6)',
  'ESLint 0 Warnings',
  'Web Crypto SHA-256',
  'Web Audio API',
  'Docker + Nginx',
  'GitHub Actions CI/CD',
];

export default function EngineeringSection({ isSpotlight, metrics, model }) {
  return (
    <section className="animate-in">
      <div className="section-header-block">
        <span className="section-eyebrow mono">
          MÓDULO 03 · ARQUITECTURA, CALIDAD Y PORTAFOLIO
        </span>
        <h2>Ingeniería Aplicada y Autoría</h2>
        <p>
          Alcance real de la arquitectura, decisiones técnicas, dossier completo
          descargable para entrevistas y perfiles profesionales.
        </p>
      </div>

      <div
        id="tour-quality-author"
        className={`lab-grid ${isSpotlight ? 'tour-spotlight' : ''}`}
      >
        <article className="card interactive-card">
          <span className="badge badge-ok">Arquitectura Modular Verificada</span>
          <h3 className="lab-card-title">
            Decisiones técnicas en Sentinel HITL
          </h3>
          <p
            style={{
              margin: '0 0 0.85rem',
              fontSize: '0.9rem',
              color: 'var(--text-muted)',
            }}
          >
            Aplicación 100 % en cliente (<em>serverless</em> en GitHub Pages)
            estructurada por responsabilidades (<code>engine/</code>,{' '}
            <code>components/</code>, <code>utils/</code>) sin simulaciones
            vacías:
          </p>

          <ul className="engineering-list">
            <li>
              <strong>ML Online con Regularización L2:</strong> Regresión
              Logística con tasa sutil (<code>lr=0.12</code>), aprobación
              autónoma restringida al 100 % segura (auditable) y compendio
              normativo español.
            </li>
            <li>
              <strong>Seguridad Estándar y 6 Labs F12:</strong> CSP restrictiva,
              Referrer-Policy, Anti-XSS, CSV Formula Guard, Web Crypto SHA-256,
              Rate Limiter HTTP 429 e Idempotencia Anti-CSRF.
            </li>
            <li>
              <strong>Rendimiento y Resiliencia:</strong> Agregación real de
              hasta 30.000 transacciones en RAM, correlación de incidentes por
              cuenta y recuperación segura ante datos corruptos en{' '}
              <code>localStorage</code>.
            </li>
          </ul>

          <div className="stack-chips mono">
            {STACK_BADGES.map((tag) => (
              <span key={tag} className="stack-chip">
                {tag}
              </span>
            ))}
          </div>
        </article>

        <article className="card interactive-card author-card">
          <div>
            <span className="pill">Autor del proyecto</span>
            <h3 style={{ margin: '0.7rem 0 0.4rem', fontSize: '1.32rem' }}>
              Roberto Di Giovanni Igartua
            </h3>
            <p
              style={{
                margin: '0 0 1.15rem',
                fontSize: '0.94rem',
                color: 'var(--text-muted)',
              }}
            >
              Desarrollador de Software (React · FastAPI · SQL) enfocado en
              seguridad de aplicaciones, interfaces ergonómicas, sistemas con IA
              supervisada (HITL) y calidad verificable mediante TDD.
            </p>

            <div className="dossier-box">
              <strong style={{ display: 'block', marginBottom: '0.25rem' }}>
                Dossier Técnico Completo del Proyecto
              </strong>
              <span style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                Incluye arquitectura modular, matriz de seguridad verificable,
                instantánea de tu sesión actual y botón integrado para guardar en
                PDF.
              </span>
              <div style={{ marginTop: '0.85rem' }}>
                <button
                  className="btn-primary"
                  onClick={() => {
                    playTone('export');
                    downloadPortfolioDossier({ metrics, model });
                  }}
                >
                  Descargar Dossier de Portafolio (HTML / PDF) ↓
                </button>
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              gap: '0.7rem',
              flexWrap: 'wrap',
              marginTop: '1.25rem',
              paddingTop: '1rem',
              borderTop: '1px solid var(--border)',
            }}
          >
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
  );
}