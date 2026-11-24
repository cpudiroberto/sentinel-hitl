/**
 * Logotipo Escudo 4D facetado (idéntico en favicon, portada, cabecera y dossier).
 */
export const SentinelBrandIcon = ({ size = 34, paused = false }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="s4dOuter" x1="6" y1="4" x2="58" y2="60" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#7dd3fc" />
        <stop offset="0.45" stopColor="#2563eb" />
        <stop offset="1" stopColor="#091838" />
      </linearGradient>
      <linearGradient id="s4dFacet" x1="32" y1="4" x2="56" y2="56" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#0c1f4a" stopOpacity="0.14" />
        <stop offset="1" stopColor="#030917" stopOpacity="0.65" />
      </linearGradient>
      <radialGradient id="s4dCore" cx="50%" cy="45%" r="55%">
        <stop offset="0" stopColor="#e0f2fe" />
        <stop offset="0.55" stopColor="#38bdf8" />
        <stop offset="1" stopColor="#0284c7" />
      </radialGradient>
    </defs>
    {/* Escudo exterior facetado */}
    <path
      d="M32 3L56 12.5V30.5C56 45.4 45.8 56.6 32 61C18.2 56.6 8 45.4 8 30.5V12.5L32 3Z"
      fill="url(#s4dOuter)"
      stroke="#e0f2fe"
      strokeWidth="2.4"
    />
    {/* Faceta derecha en sombra para volumen 4D */}
    <path
      d="M32 3L56 12.5V30.5C56 45.4 45.8 56.6 32 61V3Z"
      fill="url(#s4dFacet)"
    />
    {/* Marco interno de precisión */}
    <path
      d="M32 12L47 18V30.5C47 39.8 40.6 47.4 32 50.6C23.4 47.4 17 39.8 17 30.5V18L32 12Z"
      fill="#050e20"
      fillOpacity="0.64"
      stroke="#38bdf8"
      strokeWidth="1.9"
    />
    {/* Núcleo central activo o símbolo de pausa */}
    {paused ? (
      <>
        <rect x="25" y="23" width="5" height="16" rx="1.6" fill="#f8fafc" />
        <rect x="34" y="23" width="5" height="16" rx="1.6" fill="#f8fafc" />
      </>
    ) : (
      <>
        <circle
          cx="32"
          cy="31"
          r="9.5"
          stroke="#7dd3fc"
          strokeWidth="1.5"
          strokeDasharray="4 3"
          opacity="0.85"
        />
        <circle cx="32" cy="31" r="5" fill="url(#s4dCore)" />
      </>
    )}
  </svg>
);

export const BackgroundCrystalWaves = () => (
  <div className="bg-crystal-stage" aria-hidden="true">
    <svg className="bg-wave-svg" viewBox="0 0 1440 900" preserveAspectRatio="none">
      <defs>
        <linearGradient id="waveGlass1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--wave-a)" />
          <stop offset="55%" stopColor="var(--wave-b)" />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
      </defs>
      <path
        fill="url(#waveGlass1)"
        d="M0,180 C280,70 560,310 880,180 C1160,75 1320,210 1440,130 L1440,560 C1180,660 880,440 540,560 C260,660 120,520 0,600 Z"
      />
    </svg>
    <svg className="bg-wave-svg-2" viewBox="0 0 1440 900" preserveAspectRatio="none">
      <defs>
        <linearGradient id="waveGlass2" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="var(--wave-b)" />
          <stop offset="60%" stopColor="var(--wave-a)" />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
      </defs>
      <path
        fill="url(#waveGlass2)"
        d="M0,480 C340,360 660,640 1020,470 C1240,370 1360,460 1440,410 L1440,900 L0,900 Z"
      />
    </svg>
    <svg className="bg-wave-svg-3" viewBox="0 0 1440 900" preserveAspectRatio="none">
      <defs>
        <linearGradient id="waveGlass3" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="var(--wave-c)" />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
      </defs>
      <path
        fill="url(#waveGlass3)"
        d="M0,320 C420,210 780,440 1120,290 C1280,220 1380,290 1440,260 L1440,680 L0,680 Z"
      />
    </svg>
  </div>
);

/**
 * Fila unificada de etiquetas: [ID] [Riesgo %] [Categoría] [Nivel] [+ Agrupada]
 */
export const EventBadges = ({ evt, clusterCount = 1 }) => {
  const score = evt.risk?.score ?? 0;
  const riskClass =
    score === 0 ? 'badge-ok' : score >= 75 ? 'badge-critical' : 'badge-high';
  return (
    <div className="badge-row">
      <span className="badge badge-id mono">{evt.id}</span>
      <span className={`badge ${riskClass}`}>
        {score === 0 ? '100% Segura' : `Riesgo: ${score}%`}
      </span>
      <span className="badge badge-ai">{evt.risk?.threatCategory}</span>
      <span className="badge badge-neutral">{evt.difficulty || 'Media'}</span>
      {clusterCount > 1 && (
        <span className="badge badge-high">Agrupada · {clusterCount} casos</span>
      )}
    </div>
  );
};