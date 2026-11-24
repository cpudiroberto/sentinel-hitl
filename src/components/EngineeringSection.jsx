import {
  GITHUB_PROFILE_URL,
  LINKEDIN_URL,
  downloadPortfolioDossier,
} from '../utils/exporters';
import { playTone } from '../utils/audioEngine';

const TECH_SPECS = [
  { label: 'Interfaz y Build', value: 'React 19 · Vite 6 · CSS Grid' },
  { label: 'Calidad y Pruebas', value: 'Vitest TDD (6/6) · ESLint 0 warnings' },
  { label: 'Criptografía y Audio', value: 'Web Crypto SHA-256 · Web Audio API' },
  { label: 'Sincronización Legal', value: 'API Datos Abiertos BOE + Cron diario' },
  { label: 'Infraestructura', value: 'Docker Nginx · GitHub Actions Pages' },
  { label: 'Persistencia Segura', value: 'localStorage validado · CSV Guard' },
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
          Alcance real de la arquitectura, ficha técnica detallada, dossier
          descargable para entrevistas y perfiles profesionales.
        </p>
      </div>

      <div
        id="tour-quality-author"
        className={`lab-grid ${isSpotlight ? 'tour-spotlight' : ''}`}
      >
        <article className="card interactive-card">
          <div className="editorial-kicker mono">ARQUITECTURA MODULAR VERIFICADA</div>
          <h3 className="editorial-card-heading">
            Decisiones técnicas en Sentinel HITL
          </h3>
          <p className="editorial-lead">
            Aplicación ejecutada 100 % en cliente (<em>serverless</em> en GitHub
            Pages) con actualización diaria automatizada desde el BOE mediante
            GitHub Actions y separación estricta por módulos (
            <code>engine/</code>, <code>components/</code>, <code>utils/</code>,{' '}
            <code>scripts/</code>):
          </p>

          <ul className="engineering-list">
            <li>
              <strong>ML Online con Regularización L2:</strong> Regresión
              Logística con tasa sutil (<code>lr=0.12</code>), aprobación
              autónoma limitada al 100 % seguro y biblioteca normativa española.
            </li>
            <li>
              <strong>Defensa Verificable en F12:</strong> CSP restrictiva,
              Anti-XSS, CSV Formula Guard, Web Crypto SHA-256, Rate Limiter
              HTTP 429 e Idempotencia Anti-CSRF.
            </li>
            <li>
              <strong>Rendimiento y Consistencia:</strong> Agregación real de
              hasta 30.000 operaciones en RAM, correlación de alertas por cuenta
              y contadores acumulativos persistentes.
            </li>
          </ul>

          <div className="spec-ledger">
            {TECH_SPECS.map((item) => (
              <div key={item.label} className="spec-cell">
                <span className="spec-key">{item.label}</span>
                <strong className="spec-val mono">{item.value}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="card interactive-card author-card">
          <div>
            <div className="editorial-kicker mono">AUTOR DEL PROYECTO</div>
            <h3 className="editorial-card-heading">
              Roberto Di Giovanni Igartua
            </h3>
            <p className="editorial-lead">
              Desarrollador de Software (React · FastAPI · SQL) enfocado en
              seguridad de aplicaciones, interfaces ergonómicas, sistemas con IA
              supervisada (HITL) y calidad verificable mediante TDD.
            </p>

            <div className="dossier-box">
              <strong style={{ display: 'block', marginBottom: '0.3rem' }}>
                Dossier Técnico Completo del Proyecto
              </strong>
              <span style={{ fontSize: '0.86rem', color: 'var(--text-muted)' }}>
                Documento estructurado con arquitectura modular, matriz de
                seguridad verificable, instantánea de tu sesión actual y botón
                para imprimir o guardar en PDF.
              </span>
              <div style={{ marginTop: '0.9rem' }}>
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

          <div className="author-links-bar">
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