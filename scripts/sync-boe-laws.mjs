import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const OUTPUT_PATH = path.resolve(
  process.cwd(),
  'public',
  'data',
  'spanish-laws.json'
);

const CURATED_CHAPTERS = [
  {
    id: 'PSD2-SCA',
    chapter: 'Cap. I',
    boeId: 'BOE-A-2018-16036',
    category: 'Pagos y Autenticación (PSD2)',
    code: 'RDL 19/2018 · Directiva PSD2',
    title: 'Servicios de Pago y Autenticación Reforzada (SCA)',
    summary:
      'Exige al menos dos factores independientes en pagos electrónicos y accesos sensibles, salvo operaciones de bajo riesgo verificadas mediante análisis transaccional en tiempo real (TRA).',
    gap: 'Reutilización de sesiones activas o tokens OAuth tras un cambio abrupto de geolocalización sin forzar re-autenticación.',
    protocol:
      'Ante viaje imposible, dispositivo no reconocido o más de 2 fallos de clave, revocar la sesión, bloquear preventivamente y exigir 2FA fuera de banda.',
  },
  {
    id: 'SEPBLAC-PBC',
    chapter: 'Cap. II',
    boeId: 'BOE-A-2010-6737',
    category: 'Prevención de Blanqueo (SEPBLAC)',
    code: 'Ley 10/2010 PBC-FT',
    title: 'Prevención de Blanqueo de Capitales y Diligencia Reforzada',
    summary:
      'Obliga a aplicar medidas reforzadas de diligencia debida ante transferencias internacionales atípicas, jurisdicciones de riesgo, importes elevados o fraccionamiento sistemático.',
    gap: 'Pagos fraccionados en varias operaciones bajo el umbral de 3.000 € hacia proveedores recién creados o jurisdicciones no cooperantes.',
    protocol:
      'Retener fondos preventivamente, solicitar factura o contrato justificativo y confirmar la orden telefónicamente con el apoderado.',
  },
  {
    id: 'RGPD-ART32',
    chapter: 'Cap. III',
    boeId: 'BOE-A-2018-16673',
    category: 'Protección de Datos (RGPD / LOPDGDD)',
    code: 'LO 3/2018 · RGPD (UE 2016/679)',
    title: 'Seguridad del Tratamiento y Trazabilidad de Accesos',
    summary:
      'Exige garantizar la confidencialidad, integridad y resiliencia de los sistemas financieros, conservando registros de auditoría inalterables ante accesos anómalos.',
    gap: 'Accesos administrativos desde redes Wi-Fi públicas o VPN comerciales sin huella de dispositivo registrada ni justificación de auditoría.',
    protocol:
      'Validar identidad mediante código OTP, registrar justificación saneada en auditoría y escalar al DPO si se confirma acceso ilícito.',
  },
  {
    id: 'BDE-4-2017',
    chapter: 'Cap. IV',
    boeId: 'BOE-A-2017-14334',
    category: 'Supervisión Bancaria (Banco de España)',
    code: 'Circular 4/2017 Banco de España',
    title: 'Control Interno, Riesgo Operacional y Supervisión Humana',
    summary:
      'Establece requisitos de gobernanza, trazabilidad y control interno en entidades de crédito, exigiendo supervisión humana efectiva sobre modelos automatizados.',
    gap: 'Delegar aprobaciones masivas en algoritmos sin bandeja de auditoría muestral ni registro de falsos positivos.',
    protocol:
      'Revisar el historial de la cuenta, documentar el criterio seguido en el expediente y auditar periódicamente los casos aprobados por la IA.',
  },
  {
    id: 'ENS-RD311',
    chapter: 'Cap. V',
    boeId: 'BOE-A-2022-7191',
    category: 'Seguridad de Sistemas (ENS)',
    code: 'Real Decreto 311/2022 · ENS',
    title: 'Protección contra Fuerza Bruta, Integridad y Control de Acceso',
    summary:
      'Impone medidas técnicas verificables contra intentos repetitivos de autenticación, integridad criptográfica de registros (SHA-256) y saneamiento de entradas.',
    gap: 'Endpoints de login o APIs internas sin limitación por ventana deslizante ni claves de idempotencia ante reenvíos.',
    protocol:
      'Mantener bloqueo HTTP 429 activo, exigir tokens anti-CSRF y sellar criptográficamente los registros críticos de auditoría.',
  },
];

function formatBoeDate(raw) {
  if (!raw || typeof raw !== 'string') return 'Vigente';
  const digits = raw.replace(/\D/g, '');
  if (digits.length >= 8) {
    return `${digits.slice(6, 8)}/${digits.slice(4, 6)}/${digits.slice(0, 4)}`;
  }
  return raw;
}

function extractXmlTag(xml, tag) {
  const match = xml.match(
    new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i')
  );
  return match ? match[1].trim() : null;
}

function normalizeBoeUrl(rawUrl, boeId, isConsolidated) {
  if (rawUrl) {
    return rawUrl.startsWith('http') ? rawUrl : `https://www.boe.es${rawUrl}`;
  }
  return isConsolidated
    ? `https://www.boe.es/buscar/act.php?id=${boeId}`
    : `https://www.boe.es/buscar/doc.php?id=${boeId}`;
}

async function fetchBoeMetadata(boeId) {
  const attempts = [
    {
      url: `https://www.boe.es/datosabiertos/api/legislacion-consolidada/id/${boeId}/metadatos`,
      accept: 'application/json',
      consolidated: true,
    },
    {
      url: `https://www.boe.es/datosabiertos/api/legislacion-consolidada/id/${boeId}/metadatos`,
      accept: 'application/xml',
      consolidated: true,
    },
    {
      url: `https://www.boe.es/diario_boe/xml.php?id=${boeId}`,
      accept: 'application/xml',
      consolidated: false,
    },
  ];

  let lastReason = 'Sin respuesta';

  for (const { url, accept, consolidated } of attempts) {
    try {
      const res = await fetch(url, {
        headers: { Accept: accept },
        signal: AbortSignal.timeout(12000),
      });

      const rawText = await res.text();
      if (!res.ok) {
        lastReason = `HTTP ${res.status}`;
        continue;
      }

      const trimmed = rawText.trim();
      if (trimmed.startsWith('{')) {
        const json = JSON.parse(trimmed);
        const meta =
          json?.data?.metadatos ||
          (json?.data?.titulo || json?.data?.identificador
            ? json.data
            : null) ||
          json?.metadatos ||
          null;

        if (meta) {
          const pubDate = formatBoeDate(meta.fecha_publicacion);
          const updRaw = meta.fecha_actualizacion || meta.fecha_vigencia;
          return {
            officialTitle: meta.titulo || null,
            lastConsolidated: updRaw ? formatBoeDate(updRaw) : pubDate,
            publishedDate: pubDate,
            status:
              meta.vigencia_agotada === 'S' ? 'Derogada' : 'Vigente (BOE)',
            boeUrl: normalizeBoeUrl(
              meta.url_html_consolidada || meta.url_html,
              boeId,
              consolidated
            ),
            liveFetched: true,
          };
        }
        lastReason = 'JSON sin metadatos';
      } else if (trimmed.startsWith('<')) {
        const titulo = extractXmlTag(trimmed, 'titulo');
        if (titulo) {
          const pubDate = formatBoeDate(
            extractXmlTag(trimmed, 'fecha_publicacion')
          );
          const updRaw =
            extractXmlTag(trimmed, 'fecha_actualizacion') ||
            extractXmlTag(trimmed, 'fecha_vigencia');
          return {
            officialTitle: titulo,
            lastConsolidated: updRaw ? formatBoeDate(updRaw) : pubDate,
            publishedDate: pubDate,
            status:
              extractXmlTag(trimmed, 'vigencia_agotada') === 'S'
                ? 'Derogada'
                : 'Vigente (BOE)',
            boeUrl: normalizeBoeUrl(
              extractXmlTag(trimmed, 'url_html_consolidada') ||
                extractXmlTag(trimmed, 'url_html'),
              boeId,
              consolidated
            ),
            liveFetched: true,
          };
        }
        lastReason = 'XML sin <titulo>';
      }
    } catch (err) {
      lastReason = err?.message || 'Error de red';
    }
  }

  console.warn(`[BOE Sync] ${boeId} no verificado en vivo (${lastReason})`);
  return null;
}

async function main() {
  const results = [];
  let liveCount = 0;

  for (const item of CURATED_CHAPTERS) {
    const boeMeta = await fetchBoeMetadata(item.boeId);
    if (boeMeta?.liveFetched) {
      liveCount += 1;
      console.info(
        `[BOE Sync] OK ${item.boeId} -> fecha BOE ${boeMeta.lastConsolidated}`
      );
    }

    results.push({
      ...item,
      officialTitle: boeMeta?.officialTitle || item.title,
      lastConsolidated: boeMeta?.lastConsolidated || 'Compendio local vigente',
      publishedDate: boeMeta?.publishedDate || '-',
      status: boeMeta?.status || 'Vigente',
      boeUrl:
        boeMeta?.boeUrl || `https://www.boe.es/buscar/doc.php?id=${item.boeId}`,
      liveFetched: Boolean(boeMeta?.liveFetched),
    });
  }

  const payload = {
    source: 'API Datos Abiertos y Diario Oficial del BOE (boe.es)',
    syncedAt: new Date().toISOString(),
    liveVerifiedCount: liveCount,
    totalChapters: results.length,
    chapters: results,
  };

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.info(
    `[BOE Sync] Guardado ${OUTPUT_PATH} (${liveCount}/${results.length} verificadas en vivo desde boe.es)`
  );
}

main();