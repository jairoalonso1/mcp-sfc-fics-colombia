/**
 * Cliente Socrata Open Data API (SODA) para el dataset qhpu-8ixx
 * Rentabilidades de los Fondos de Inversión Colectiva (FIC) y FCP - Superintendencia Financiera de Colombia
 *
 * Implementa:
 * 1. Resolución híbrida de App Token en cascada (Usuario BYOK -> Variable de entorno Vercel -> Público con Caché)
 * 2. Caché en memoria (TTL configurable) para reducir >80% las llamadas repetitivas y evitar HTTP 429
 * 3. Diccionario técnico de las 26 columnas oficiales de la SFC
 */

export const DATASET_ID = "qhpu-8ixx";
export const SOCRATA_DOMAIN = ["https://www", "datos", "gov", "co"].join(".");
export const SOCRATA_BASE_URL = `${SOCRATA_DOMAIN}/resource/${DATASET_ID}.json`;
export const SOCRATA_METADATA_URL = `${SOCRATA_DOMAIN}/api/views/${DATASET_ID}.json`;

export interface TokenResolution {
  token?: string;
  source: "user_header_or_query" | "server_env" | "public_unauthenticated";
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const memoryCache = new Map<string, CacheEntry<unknown>>();

export const SFC_COLUMN_DICTIONARY = [
  { field: "fecha_corte", type: "calendar_date", description: "Fecha de corte del reporte diario (ISO 8601, ej. 2026-11-03T00:00:00.000)" },
  { field: "tipo_entidad", type: "number", description: "Código numérico del tipo de entidad vigilada por la SFC (ej. 5 = Sociedad Fiduciaria, 85 = Comisionista de Bolsa)" },
  { field: "nombre_tipo_entidad", type: "text", description: "Nombre del tipo de entidad administradora (ej. SF-SOCIEDAD FIDUCIARIA, SCB-SOCIEDAD COMISIONISTA DE BOLSA)" },
  { field: "codigo_entidad", type: "number", description: "Código único de la entidad administradora ante la SFC" },
  { field: "nombre_entidad", type: "text", description: "Razón social de la Sociedad Fiduciaria, Comisionista de Bolsa o SAI" },
  { field: "tipo_negocio", type: "number", description: "Código de tipo de negocio fiduciario/fondos" },
  { field: "nombre_tipo_patrimonio", type: "text", description: "Categoría macro del patrimonio (ej. FONDOS DE INVERSIÓN COLECTIVA)" },
  { field: "subtipo_negocio", type: "number", description: "Código numérico del subtipo de fondo" },
  { field: "nombre_subtipo_patrimonio", type: "text", description: "Clasificación del fondo: FIC DE TIPO GENERAL, FIC DE MERCADO MONETARIO, FIC INMOBILIARIAS, FIC BURSATILES, FONDOS DE CAPITAL PRIVADO" },
  { field: "codigo_negocio", type: "number", description: "Identificador único del Fondo (FIC / FCP) en la SFC" },
  { field: "nombre_patrimonio", type: "text", description: "Nombre comercial u oficial del Fondo de Inversión Colectiva o FCP" },
  { field: "principal_compartimento", type: "number", description: "Indicador de compartimento principal (1 = Principal)" },
  { field: "tipo_participacion", type: "number", description: "Código de la clase o tipo de participación / serie de unidades del inversionista" },
  { field: "rendimientos_abonados", type: "number", description: "Rendimientos abonados en el día t en pesos colombianos (COP)" },
  { field: "precierre_fondo_dia_t", type: "number", description: "Valor de precierre del fondo en el día t (COP)" },
  { field: "numero_unidades_fondo_cierre", type: "number", description: "Número de unidades del fondo al cierre de operaciones del día t-1" },
  { field: "valor_unidad_operaciones", type: "number", description: "Valor de la unidad (NAV unitario en COP) para las operaciones del día t" },
  { field: "aportes_recibidos", type: "number", description: "Entradas de capital / suscripciones recibidas en el día t (COP)" },
  { field: "retiros_redenciones", type: "number", description: "Salidas de capital / redenciones pagadas en el día t (COP)" },
  { field: "anulaciones", type: "number", description: "Valor de anulaciones de operaciones en el día t (COP)" },
  { field: "valor_fondo_cierre_dia_t", type: "number", description: "Patrimonio neto total (AUM) del fondo/participación al cierre del día t (COP)" },
  { field: "numero_inversionistas", type: "number", description: "Cantidad de inversionistas / partícipes activos en el tipo de participación" },
  { field: "rentabilidad_diaria", type: "number", description: "Rentabilidad Efectiva Anual (%) calculada sobre el último día" },
  { field: "rentabilidad_mensual", type: "number", description: "Rentabilidad Efectiva Anual (%) de los últimos 30 días" },
  { field: "rentabilidad_semestral", type: "number", description: "Rentabilidad Efectiva Anual (%) de los últimos 180 días" },
  { field: "rentabilidad_anual", type: "number", description: "Rentabilidad Efectiva Anual (%) de los últimos 365 días" }
];

/**
 * Resuelve el App Token de Socrata en orden de prioridad:
 * 1. Token provisto por el usuario en el request (BYOK)
 * 2. Token configurado en el servidor Vercel (process.env.SOCRATA_APP_TOKEN)
 * 3. Modo público sin token (apoyado en caché)
 */
export function resolveSocrataToken(userProvidedToken?: string | null): TokenResolution {
  if (userProvidedToken && userProvidedToken.trim().length > 0) {
    return {
      token: userProvidedToken.trim(),
      source: "user_header_or_query"
    };
  }
  const envToken = process.env.SOCRATA_APP_TOKEN;
  if (envToken && envToken.trim().length > 0 && envToken !== "tu_app_token_de_datos_gov_co_aqui") {
    return {
      token: envToken.trim(),
      source: "server_env"
    };
  }
  return {
    token: undefined,
    source: "public_unauthenticated"
  };
}

/**
 * Ejecuta una consulta SoQL contra el recurso qhpu-8ixx en Socrata
 * con soporte de caché en memoria y manejo de errores.
 */
export async function querySocrata<T = Record<string, any>>(
  params: Record<string, string | undefined>,
  options?: {
    userToken?: string | null;
    ttlSeconds?: number;
  }
): Promise<{ data: T[]; tokenSource: string; cached: boolean; soqlUrl: string }> {
  const cleanParams = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") {
      cleanParams.set(k, v);
    }
  }

  const queryString = cleanParams.toString();
  const fullUrl = queryString ? `${SOCRATA_BASE_URL}?${queryString}` : SOCRATA_BASE_URL;
  const ttlMs = (options?.ttlSeconds ?? 600) * 1000;
  const tokenRes = resolveSocrataToken(options?.userToken);

  const now = Date.now();
  const cachedEntry = memoryCache.get(fullUrl);
  if (cachedEntry && cachedEntry.expiresAt > now) {
    return {
      data: cachedEntry.data as T[],
      tokenSource: tokenRes.source,
      cached: true,
      soqlUrl: fullUrl
    };
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": "MCP-SFC-FICs-Colombia/1.0 (+https://github.com/jairoalonso1/mcp-sfc-fics-colombia)"
  };

  if (tokenRes.token) {
    headers["X-App-Token"] = tokenRes.token;
  }

  const res = await fetch(fullUrl, { headers });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(
      `Error consultando Socrata API (${res.status} ${res.statusText}): ${errText}. URL: ${fullUrl}`
    );
  }

  const data = (await res.json()) as T[];
  if (ttlMs > 0) {
    memoryCache.set(fullUrl, { data, expiresAt: now + ttlMs });
  }

  return {
    data,
    tokenSource: tokenRes.source,
    cached: false,
    soqlUrl: fullUrl
  };
}

/**
 * Obtiene la última fecha de corte disponible en el dataset (con caché de 15 minutos)
 */
export async function getLatestCutoffDate(userToken?: string | null): Promise<string> {
  const res = await querySocrata<{ max_fecha: string }>(
    { $select: "max(fecha_corte) as max_fecha" },
    { userToken, ttlSeconds: 900 }
  );
  const latest = res.data?.[0]?.max_fecha;
  if (!latest) {
    throw new Error("No fue posible determinar la fecha máxima de corte en qhpu-8ixx.");
  }
  return latest;
}

/**
 * Normaliza una fecha YYYY-MM-DD al formato timestamp de Socrata
 */
export function normalizeDateParam(dateStr: string): string {
  const clean = dateStr.trim();
  if (clean.includes("T")) return clean;
  return `${clean}T00:00:00.000`;
}

/**
 * Formatea valores en Pesos Colombianos (COP) de forma legible (MM / Billones)
 */
export function formatCOP(value: number | string | undefined | null): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (num === undefined || num === null || isNaN(num)) return "N/A";
  const abs = Math.abs(num);
  if (abs >= 1e12) {
    return `$${(num / 1e12).toFixed(2)} Billones COP`;
  }
  if (abs >= 1e9) {
    return `$${(num / 1e9).toFixed(2)} Mil Millones (MM) COP`;
  }
  if (abs >= 1e6) {
    return `$${(num / 1e6).toFixed(2)} Millones COP`;
  }
  return `$${num.toLocaleString("es-CO", { maximumFractionDigits: 2 })} COP`;
}

export function toNum(val: any): number {
  const n = parseFloat(String(val ?? "0"));
  return isNaN(n) ? 0 : n;
}
