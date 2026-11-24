import { escapeCsvCell } from '../engine/securityEngine';

export const GITHUB_PROFILE_URL = 'https://github.com/cpudiroberto';
export const LINKEDIN_URL =
  'https://www.linkedin.com/in/roberto-di-giovanni-igartua-718338209/';

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportSessionData(format, { events, metrics, model }) {
  const dateTag = new Date().toISOString().slice(0, 10);
  const groupedByAccount = {};
  events.forEach((e) => {
    if (!groupedByAccount[e.account]) groupedByAccount[e.account] = [];
    groupedByAccount[e.account].push(e);
  });

  if (format === 'csv') {
    const header =
      'Cuenta;IncidentesEnCuenta;ID;Dificultad;Categoria;Operacion;Canal;IP;ImporteEUR;Riesgo%;Estado;Normativa;Nota\n';
    const rows = events
      .map((e) =>
        [
          escapeCsvCell(e.account),
          groupedByAccount[e.account].length,
          escapeCsvCell(e.id),
          escapeCsvCell(e.difficulty || 'Media'),
          escapeCsvCell(e.risk.threatCategory),
          escapeCsvCell(e.title),
          escapeCsvCell(e.channel || 'Web'),
          escapeCsvCell(e.ip || '-'),
          e.amount || 0,
          e.risk.score,
          escapeCsvCell(e.status),
          escapeCsvCell(e.risk.legal?.law || ''),
          escapeCsvCell(e.note || ''),
        ].join(';')
      )
      .join('\n');
    downloadFile(
      `\uFEFF${header}${rows}`,
      `sentinel-hitl-agrupado-${dateTag}.csv`,
      'text/csv;charset=utf-8'
    );
    return;
  }

  if (format === 'txt') {
    const clustersTxt = Object.entries(groupedByAccount)
      .map(
        ([acc, list]) =>
          `\n[CUENTA: ${acc}] (${list.length} evento/s)\n` +
          list
            .map(
              (e) =>
                `  - ${e.id} | ${e.status} | Riesgo ${e.risk.score}% | ${e.title} (${e.amount || 0} €) | ${e.risk.legal?.law || ''}`
            )
            .join('\n')
      )
      .join('\n');
    const summary = [
      `INFORME DE AUDITORÍA AGRUPADO · SENTINEL HITL (${dateTag})`,
      `==========================================================`,
      `Aprobadas por IA (100% seguras): ${metrics.aiApproved}`,
      `Resueltas en total (IA + Humano): ${metrics.totalResolved}`,
      `Capital protegido: ${metrics.protectedCapital.toLocaleString('es-ES')} €`,
      `Estado operativo: ${metrics.statusDetail}`,
      clustersTxt,
    ].join('\n');
    downloadFile(
      summary,
      `sentinel-hitl-resumen-${dateTag}.txt`,
      'text/plain;charset=utf-8'
    );
    return;
  }

  downloadFile(
    JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        system: 'Sentinel HITL',
        model,
        metrics,
        groupedIncidents: groupedByAccount,
      },
      null,
      2
    ),
    `sentinel-hitl-modelo-${dateTag}.json`,
    'application/json'
  );
}

/**
 * Genera un dossier técnico completo del portafolio (HTML limpio + botón Imprimir a PDF).
 */
export function downloadPortfolioDossier({ metrics, model }) {
  const dateStr = new Date().toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"/><title>Dossier Técnico de Portafolio · Sentinel HITL</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#0b1426;background:#f1f5f9;margin:0;padding:28px;line-height:1.6}
  .page{max-width:900px;margin:0 auto;background:#fff;padding:40px 44px;border-radius:16px;box-shadow:0 14px 40px rgba(11,20,38,0.08)}
  header{display:flex;justify-content:space-between;align-items:center;gap:16px;border-bottom:3px solid #1d4ed8;padding-bottom:18px;margin-bottom:24px;flex-wrap:wrap}
  .brand{display:flex;align-items:center;gap:14px}
  h1{margin:0;font-size:25px;color:#071326;letter-spacing:-0.02em}
  .sub{color:#475569;font-size:13.5px;margin-top:3px}
  .print-btn{background:#1d4ed8;color:#fff;border:none;padding:10px 16px;border-radius:9px;font-weight:700;cursor:pointer;font-size:13px}
  h2{color:#1d4ed8;font-size:17px;margin:26px 0 10px;border-bottom:1px solid #cbd5e1;padding-bottom:5px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
  .box{background:#f4f7fc;border:1px solid #cbd5e1;border-radius:10px;padding:14px 18px;font-size:13.5px}
  table{width:100%;border-collapse:collapse;font-size:13px;margin-top:10px}
  th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #e2e8f0}
  th{background:#f8fafc;color:#0f172a}
  ul{margin:6px 0 0;padding-left:20px;font-size:13.5px} li{margin-bottom:5px}
  footer{margin-top:34px;padding-top:14px;border-top:2px solid #071326;display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;font-size:13px}
  a{color:#1d4ed8;font-weight:700;text-decoration:none}
  @media print{body{background:#fff;padding:0}.page{box-shadow:none;padding:12px}.print-btn{display:none}}
</style></head><body>
<div class="page">
<header>
  <div class="brand">
    <svg width="50" height="50" viewBox="0 0 64 64" fill="none">
      <defs><linearGradient id="g" x1="6" y1="4" x2="58" y2="60" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#7dd3fc"/><stop offset="0.45" stop-color="#2563eb"/><stop offset="1" stop-color="#091838"/></linearGradient></defs>
      <path d="M32 3L56 12.5V30.5C56 45.4 45.8 56.6 32 61C18.2 56.6 8 45.4 8 30.5V12.5L32 3Z" fill="url(#g)" stroke="#071326" stroke-width="2.5"/>
      <circle cx="32" cy="31" r="6" fill="#38bdf8"/>
    </svg>
    <div>
      <h1>Sentinel HITL · Dossier Técnico de Portafolio</h1>
      <div class="sub">Arquitectura Antifraude con IA* Supervisada (HITL) · Generado el ${dateStr}</div>
    </div>
  </div>
  <button class="print-btn" onclick="window.print()">Imprimir / Guardar PDF</button>
</header>

<h2>1. Resumen Ejecutivo y Transparencia Arquitectónica</h2>
<div class="box">
  <strong>Sentinel HITL</strong> es una consola interactiva de seguridad bancaria ejecutada 100 % en cliente (arquitectura <em>serverless</em> desplegada en GitHub Pages). Su objetivo es demostrar de forma empírica y verificable en navegador ingeniería Frontend avanzada, Machine Learning online supervisado por humanos (Human-in-the-Loop), endurecimiento de seguridad web (Hardening) y optimización algorítmica.
</div>

<h2>2. Arquitectura Modular y Stack Tecnológico</h2>
<div class="grid">
  <div class="box">
    <strong>Estructura de Código Limpia</strong>
    <ul>
      <li><code>src/engine/securityEngine.js</code>: Motor ML Online (LogReg + L2), Rate Limiter, SHA-256, Anti-CSRF, Anti-XSS y Benchmark.</li>
      <li><code>src/engine/eventGenerator.js</code>: Generador combinatorio de casos y validación de persistencia.</li>
      <li><code>src/components/</code>: Separación de vistas (<code>DefenseLab</code>, <code>EngineeringSection</code>, <code>ModalsAndTour</code>, <code>BrandAssets</code>).</li>
      <li><code>src/utils/</code>: Motor Web Audio API sin warnings y exportadores seguros.</li>
    </ul>
  </div>
  <div class="box">
    <strong>Stack y Calidad Verificada</strong>
    <ul>
      <li><strong>Core:</strong> React 19, Vite 6, CSS Grid/Custom Properties.</li>
      <li><strong>Testing (TDD):</strong> 6 tests unitarios en Vitest (0 fallos).</li>
      <li><strong>Calidad:</strong> ESLint (0 errores, 0 warnings) y Prettier.</li>
      <li><strong>DevOps:</strong> GitHub Flow, Dockerfile multi-etapa con Nginx y CI/CD en GitHub Actions.</li>
    </ul>
  </div>
</div>

<h2>3. Modelo de Amenazas y 6 Capacidades Verificables en F12</h2>
<table>
  <thead><tr><th>Capacidad</th><th>Implementación Real</th><th>Cómo verificarlo</th></tr></thead>
  <tbody>
    <tr><td><strong>IA Supervisada (HITL)</strong></td><td>Regresión Logística Online con regularización L2 (<code>lr=0.12</code>). Solo aprueba al 100 % segura (auditable).</td><td>Revisar alertas, observar recalibración de riesgo y compendio PSD2/SEPBLAC.</td></tr>
    <tr><td><strong>Escudo HTTP 429</strong></td><td>Rate Limiter por ventana deslizante (5 req/60s) con simulación de ráfaga.</td><td>Módulo 2 · Tarjeta 1 + trazas <code>[Sentinel HTTP 429]</code> en F12.</td></tr>
    <tr><td><strong>Optimización N+1</strong></td><td>Generación real en RAM de hasta 30.000 transacciones y comparación $O(N \\cdot M)$ vs $O(N)$.</td><td>Módulo 2 · Tarjeta 2 + <code>console.table()</code> en F12 (&gt;70 % menos latencia).</td></tr>
    <tr><td><strong>Anti-XSS &amp; CSV Guard</strong></td><td>Eliminación de etiquetas HTML/script y neutralización de fórmulas Excel (<code>= + - @</code>).</td><td>Módulo 2 · Tarjeta 3 y 6 + exportación segura a <code>.CSV</code>.</td></tr>
    <tr><td><strong>Web Crypto SHA-256</strong></td><td>Firma criptográfica nativa del navegador (<code>crypto.subtle.digest</code>).</td><td>Módulo 2 · Tarjeta 4: botón «Alterar +1 €» detecta manipulación.</td></tr>
    <tr><td><strong>Anti-CSRF &amp; CSP</strong></td><td>Claves de idempotencia (HTTP 409), token CSRF (403) y meta CSP restrictiva.</td><td>Módulo 2 · Tarjeta 5 y 6 + listener <code>securitypolicyviolation</code>.</td></tr>
  </tbody>
</table>

<h2>4. Instantánea de la Sesión Actual</h2>
<div class="box">
  Pendientes: <strong>${metrics.pending}</strong> · Aprobadas por IA (100 % seguras): <strong>${metrics.aiApproved}</strong> · Resueltas en total: <strong>${metrics.totalResolved}</strong> · Capital protegido: <strong>${metrics.protectedCapital.toLocaleString('es-ES')} €</strong> · Versión del motor: <code>${model.version}</code>.
</div>

<footer>
  <div><strong>Autor:</strong> Roberto Di Giovanni Igartua · Desarrollador Full Stack (React · FastAPI · SQL)</div>
  <div><a href="${LINKEDIN_URL}" target="_blank" rel="noopener noreferrer">LinkedIn</a> · <a href="${GITHUB_PROFILE_URL}" target="_blank" rel="noopener noreferrer">GitHub</a></div>
</footer>
</div></body></html>`;

  downloadFile(
    html,
    'Sentinel-HITL-Dossier-Tecnico-Roberto-Di-Giovanni.html',
    'text/html;charset=utf-8'
  );
}