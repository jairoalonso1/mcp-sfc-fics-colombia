import {
  DATASET_ID,
  SOCRATA_BASE_URL,
  SFC_COLUMN_DICTIONARY,
  querySocrata,
  getLatestCutoffDate,
  normalizeDateParam,
  formatCOP,
  toNum
} from "./socrata";

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
}

export const MCP_TOOLS: McpToolDefinition[] = [
  {
    name: "obtener_estado_dataset",
    description:
      "Obtiene el estado actual del dataset oficial qhpu-8ixx de la Superintendencia Financiera de Colombia (SFC) en datos.gov.co: fecha máxima de corte reportada, total de registros históricos, número de entidades y fondos activos, estado del App Token Socrata y diccionario de las 26 columnas.",
    inputSchema: {
      type: "object",
      properties: {
        incluir_diccionario: {
          type: "boolean",
          description: "Si es true (por defecto), incluye el diccionario completo de las 26 columnas.",
          default: true
        }
      }
    }
  },
  {
    name: "listar_entidades_administradoras",
    description:
      "Lista todas las Sociedades Fiduciarias, Sociedades Comisionistas de Bolsa (SCB) y Sociedades Administradoras de Inversión (SAI) activas en la última fecha de corte (o fecha especificada), junto con su código SFC, cantidad de fondos (FIC/FCP), número de inversionistas y patrimonio total administrado (AUM en COP).",
    inputSchema: {
      type: "object",
      properties: {
        fecha_corte: {
          type: "string",
          description: "Fecha de corte opcional (YYYY-MM-DD). Si se omite, usa la última fecha disponible en la SFC."
        },
        tipo_entidad_filtro: {
          type: "string",
          description: "Filtro opcional por texto del tipo de entidad (ej. 'FIDUCIARIA', 'COMISIONISTA')."
        },
        limite: {
          type: "number",
          description: "Cantidad máxima de entidades a retornar (por defecto 50).",
          default: 50
        }
      }
    }
  },
  {
    name: "buscar_fondos_fic",
    description:
      "Busca Fondos de Inversión Colectiva (FIC) o Fondos de Capital Privado (FCP) por palabra clave del nombre del fondo, nombre/código de entidad fiduciaria, código de negocio o subtipo de patrimonio (ej. 'FIC DE TIPO GENERAL', 'FONDO BURSATIL', 'INMOBILIARIO', 'CAPITAL PRIVADO'). Devuelve sus tipos de participación activos, AUM y rentabilidades recientes.",
    inputSchema: {
      type: "object",
      properties: {
        texto_busqueda: {
          type: "string",
          description: "Palabra clave del nombre del fondo o entidad (ej. 'FIDUCOLDEX', 'CREDICORP', 'LIQUIDEZ', 'SOSTENIBLE', 'INDEXADO')."
        },
        codigo_entidad: {
          type: "string",
          description: "Código numérico de la entidad administradora ante la SFC (opcional)."
        },
        codigo_negocio: {
          type: "string",
          description: "Código único del fondo/negocio ante la SFC (opcional)."
        },
        subtipo_patrimonio: {
          type: "string",
          description: "Filtro por subtipo de fondo (ej. 'GENERAL', 'MONETARIO', 'INMOBILIARIO', 'BURSATIL', 'PRIVADO')."
        },
        fecha_corte: {
          type: "string",
          description: "Fecha de corte opcional (YYYY-MM-DD). Si se omite, consulta la fecha más reciente."
        },
        limite: {
          type: "number",
          description: "Máximo de registros a devolver (por defecto 30).",
          default: 30
        }
      }
    }
  },
  {
    name: "radiografia_fondo",
    description:
      "Entrega la ficha institucional completa de un fondo específico (por codigo_negocio y opcionalmente codigo_entidad o tipo_participacion) en la fecha más reciente: desglose de todas sus clases/tipos de participación, AUM total del fondo, valor de unidad, número de inversionistas, ticket promedio por inversionista, flujos del día y curva completa de rentabilidades E.A. (diaria, mensual 30d, semestral 180d, anual 365d).",
    inputSchema: {
      type: "object",
      required: ["codigo_negocio"],
      properties: {
        codigo_negocio: {
          type: "string",
          description: "Código numérico del negocio/fondo en la SFC (ej. '8686')."
        },
        codigo_entidad: {
          type: "string",
          description: "Código numérico de la entidad administradora (opcional, útil si dos entidades comparten código de negocio)."
        },
        tipo_participacion: {
          type: "string",
          description: "Código del tipo de participación específico (opcional). Si se omite, trae todas las participaciones del fondo."
        },
        fecha_corte: {
          type: "string",
          description: "Fecha de corte (YYYY-MM-DD). Si se omite, usa la última fecha disponible."
        }
      }
    }
  },
  {
    name: "ranking_rentabilidades_fics",
    description:
      "Genera el Top N o Bottom N de los Fondos de Inversión Colectiva según su rentabilidad Efectiva Anual (diaria, mensual, semestral o anual) en una fecha de corte, permitiendo filtrar por subtipo de fondo, entidad administradora y patrimonio mínimo (AUM en COP) para excluir fondos pequeños o distorsiones atípicas.",
    inputSchema: {
      type: "object",
      properties: {
        horizonte: {
          type: "string",
          enum: ["rentabilidad_diaria", "rentabilidad_mensual", "rentabilidad_semestral", "rentabilidad_anual"],
          description: "Plazo de rentabilidad E.A. para ordenar el ranking (por defecto 'rentabilidad_anual').",
          default: "rentabilidad_anual"
        },
        orden: {
          type: "string",
          enum: ["DESC", "ASC"],
          description: "DESC para los más rentables (Top), ASC para los de menor rentabilidad (Bottom).",
          default: "DESC"
        },
        subtipo_patrimonio: {
          type: "string",
          description: "Filtro opcional por categoría de FIC (ej. 'GENERAL', 'MONETARIO', 'INMOBILIARIO', 'PRIVADO')."
        },
        nombre_entidad: {
          type: "string",
          description: "Filtro opcional por nombre de Sociedad Fiduciaria o Comisionista."
        },
        aum_minimo_cop: {
          type: "number",
          description: "Patrimonio mínimo al cierre (valor_fondo_cierre_dia_t en COP) para filtrar fondos representativos (por defecto 1000000000 = $1.000 MM COP).",
          default: 1000000000
        },
        fecha_corte: {
          type: "string",
          description: "Fecha de corte (YYYY-MM-DD). Si se omite, usa la última disponible."
        },
        limite: {
          type: "number",
          description: "Número de fondos en el ranking (por defecto 20).",
          default: 20
        }
      }
    }
  },
  {
    name: "cuota_mercado_aum_entidades",
    description:
      "Calcula el Market Share (cuota de mercado porcentual) de la industria de FICs y FCPs en Colombia agrupado por entidad administradora y/o subtipo de patrimonio en una fecha de corte, sumando el AUM total (valor_fondo_cierre_dia_t), número total de inversionistas y flujos del día.",
    inputSchema: {
      type: "object",
      properties: {
        agrupar_por: {
          type: "string",
          enum: ["entidad", "subtipo_patrimonio", "tipo_entidad"],
          description: "Nivel de agrupación del Market Share (por defecto 'entidad').",
          default: "entidad"
        },
        subtipo_patrimonio: {
          type: "string",
          description: "Filtro opcional si se desea calcular el Market Share solo dentro de una categoría (ej. 'FIC DE TIPO GENERAL')."
        },
        fecha_corte: {
          type: "string",
          description: "Fecha de corte (YYYY-MM-DD). Si se omite, usa la más reciente."
        },
        limite: {
          type: "number",
          description: "Top N entidades a mostrar (por defecto 30).",
          default: 30
        }
      }
    }
  },
  {
    name: "flujos_netos_captacion",
    description:
      "Analiza la dinámica de captación comercial e institucional en una ventana de tiempo calculando Aportes Recibidos, Retiros/Redenciones, Anulaciones y el Flujo Neto de Caja (Aportes - Retiros - Anulaciones) agrupado por entidad administradora o por fondo específico.",
    inputSchema: {
      type: "object",
      required: ["fecha_inicio"],
      properties: {
        fecha_inicio: {
          type: "string",
          description: "Fecha inicial del periodo a analizar (YYYY-MM-DD)."
        },
        fecha_fin: {
          type: "string",
          description: "Fecha final del periodo (YYYY-MM-DD). Si se omite, usa la última fecha disponible."
        },
        nivel_agrupacion: {
          type: "string",
          enum: ["entidad", "fondo"],
          description: "Agrupar flujos netos por 'entidad' fiduciaria/comisionista o por 'fondo' individual.",
          default: "entidad"
        },
        codigo_entidad: {
          type: "string",
          description: "Opcional: filtrar únicamente los fondos de una entidad administradora específica."
        },
        orden: {
          type: "string",
          enum: ["MAYOR_CAPTACION", "MAYOR_SALIDA"],
          description: "Ordenar por mayores captaciones netas o mayores salidas/redenciones netas.",
          default: "MAYOR_CAPTACION"
        },
        limite: {
          type: "number",
          description: "Máximo de resultados (por defecto 25).",
          default: 25
        }
      }
    }
  },
  {
    name: "radar_corridas_y_alertas_liquidez",
    description:
      "Escanea una fecha de corte (o rango reciente) para detectar alertas de liquidez y retiros masivos donde las redenciones del día (retiros_redenciones) superan un porcentaje crítico del patrimonio de precierre (precierre_fondo_dia_t).",
    inputSchema: {
      type: "object",
      properties: {
        fecha_corte: {
          type: "string",
          description: "Fecha de corte a escanear (YYYY-MM-DD). Si se omite, escanea la última fecha disponible."
        },
        umbral_retiro_pct: {
          type: "number",
          description: "Porcentaje mínimo de retiro sobre el precierre del fondo para disparar alerta (ej. 5 para 5%). Por defecto 5.",
          default: 5
        },
        aum_minimo_cop: {
          type: "number",
          description: "Patrimonio de precierre mínimo en COP para evitar ruido de fondos diminutos (por defecto 5000000000 = $5.000 MM COP).",
          default: 5000000000
        },
        limite: {
          type: "number",
          description: "Cantidad máxima de alertas a devolver (por defecto 25).",
          default: 25
        }
      }
    }
  },
  {
    name: "serie_historica_nav_y_tasas",
    description:
      "Extrae la serie de tiempo histórica de un fondo y tipo de participación entre dos fechas: evolución del valor_unidad_operaciones (NAV), patrimonio al cierre, número de inversionistas, flujos netos y rentabilidades reportadas.",
    inputSchema: {
      type: "object",
      required: ["codigo_negocio", "fecha_inicio"],
      properties: {
        codigo_negocio: {
          type: "string",
          description: "Código del negocio/fondo en la SFC."
        },
        tipo_participacion: {
          type: "string",
          description: "Código del tipo de participación (ej. '800'). Si se omite, selecciona automáticamente la participación de mayor AUM."
        },
        codigo_entidad: {
          type: "string",
          description: "Código numérico de la entidad administradora (opcional)."
        },
        fecha_inicio: {
          type: "string",
          description: "Fecha inicial de la serie (YYYY-MM-DD)."
        },
        fecha_fin: {
          type: "string",
          description: "Fecha final de la serie (YYYY-MM-DD). Si se omite, usa la última disponible."
        },
        frecuencia_muestreo: {
          type: "string",
          enum: ["diaria", "semanal", "mensual"],
          description: "Frecuencia de los puntos devueltos para optimizar tokens (por defecto 'diaria').",
          default: "diaria"
        },
        limite: {
          type: "number",
          description: "Máximo de observaciones a extraer de Socrata (por defecto 365).",
          default: 365
        }
      }
    }
  },
  {
    name: "metricas_riesgo_cuantitativo",
    description:
      "Calcula métricas cuantitativas institucionales directamente sobre la serie de valor_unidad_operaciones (NAV) de un FIC en un rango de fechas: Retorno Acumulado, Rentabilidad Efectiva Anual exacta (CAGR), Volatilidad Anualizada, Maximum Drawdown (Max DD), Ratio de Sharpe, Ratio de Sortino y Estadísticas de Flujos.",
    inputSchema: {
      type: "object",
      required: ["codigo_negocio", "fecha_inicio"],
      properties: {
        codigo_negocio: {
          type: "string",
          description: "Código del negocio/fondo en la SFC."
        },
        tipo_participacion: {
          type: "string",
          description: "Tipo de participación a evaluar. Si se omite, evalúa la participación principal por AUM."
        },
        codigo_entidad: {
          type: "string",
          description: "Código de entidad administradora (opcional)."
        },
        fecha_inicio: {
          type: "string",
          description: "Fecha de inicio del cálculo cuantitativo (YYYY-MM-DD)."
        },
        fecha_fin: {
          type: "string",
          description: "Fecha de fin del cálculo (YYYY-MM-DD). Si se omite, usa la última fecha disponible."
        },
        tasa_libre_riesgo_ea_pct: {
          type: "number",
          description: "Tasa libre de riesgo Efectiva Anual (%) de referencia (ej. IBR / TES corto plazo) para el cálculo de Sharpe y Sortino (por defecto 9.5%).",
          default: 9.5
        }
      }
    }
  },
  {
    name: "comparar_peer_group_fics",
    description:
      "Compara frente a frente un grupo de fondos (Peer Group de 2 a 8 códigos de negocio) en la última fecha de corte disponible: compara AUM, cantidad de inversionistas, ticket promedio por inversionista, rentabilidad diaria, 30d, 180d y 365d E.A., y flujo neto reciente.",
    inputSchema: {
      type: "object",
      required: ["codigos_negocio"],
      properties: {
        codigos_negocio: {
          type: "array",
          items: { type: "string" },
          description: "Lista de códigos de negocio SFC a comparar (ej. ['8686', '10234', '5432'])."
        },
        fecha_corte: {
          type: "string",
          description: "Fecha de corte opcional (YYYY-MM-DD). Si se omite, usa la última disponible."
        }
      }
    }
  },
  {
    name: "ejecutar_soql_avanzado",
    description:
      "Ejecuta una consulta SoQL (Socrata Query Language) directa y personalizada sobre el dataset qhpu-8ixx (https://www.datos.gov.co/resource/qhpu-8ixx.json). Ideal para agregaciones ad-hoc, cruces estadísticos o filtros avanzados usando las 26 columnas oficiales de la SFC.",
    inputSchema: {
      type: "object",
      properties: {
        select: {
          type: "string",
          description: "Cláusula $select SoQL (ej. 'nombre_entidad, sum(valor_fondo_cierre_dia_t) as aum')."
        },
        where: {
          type: "string",
          description: "Cláusula $where SoQL (ej. \"fecha_corte = '2026-11-01T00:00:00.000' AND rentabilidad_anual > 10\")."
        },
        group: {
          type: "string",
          description: "Cláusula $group SoQL (ej. 'nombre_entidad')."
        },
        having: {
          type: "string",
          description: "Cláusula $having SoQL."
        },
        order: {
          type: "string",
          description: "Cláusula $order SoQL (ej. 'aum DESC')."
        },
        q: {
          type: "string",
          description: "Búsqueda de texto completo $q en todas las columnas."
        },
        limit: {
          type: "number",
          description: "Límite máximo de filas $limit (por defecto 50, máximo 1000).",
          default: 50
        },
        offset: {
          type: "number",
          description: "Desplazamiento $offset para paginación."
        }
      }
    }
  }
];

export async function executeMcpTool(
  name: string,
  args: Record<string, any> = {},
  userToken?: string | null
): Promise<any> {
  switch (name) {
    case "obtener_estado_dataset": {
      const latestDate = await getLatestCutoffDate(userToken);
      const [totalCountRes, latestSummaryRes] = await Promise.all([
        querySocrata<{ total_filas: string }>(
          { $select: "count(*) as total_filas" },
          { userToken, ttlSeconds: 3600 }
        ),
        querySocrata<{
          entidades_activas: string;
          fondos_activos: string;
          participaciones_activas: string;
          aum_total_cop: string;
          inversionistas_totales: string;
        }>(
          {
            $select:
              "count(distinct codigo_entidad) as entidades_activas, count(distinct codigo_negocio) as fondos_activos, count(*) as participaciones_activas, sum(valor_fondo_cierre_dia_t) as aum_total_cop, sum(numero_inversionistas) as inversionistas_totales",
            $where: `fecha_corte = '${latestDate}'`
          },
          { userToken, ttlSeconds: 900 }
        )
      ]);

      const summary = latestSummaryRes.data[0] || {};
      const incluirDiccionario = args.incluir_diccionario !== false;

      return {
        dataset_id: DATASET_ID,
        fuente: "Superintendencia Financiera de Colombia (SFC) - Datos Abiertos (datos.gov.co)",
        endpoint_socrata: SOCRATA_BASE_URL,
        modo_autenticacion_socrata: latestSummaryRes.tokenSource,
        respuesta_desde_cache: latestSummaryRes.cached,
        ultima_fecha_corte: latestDate,
        total_registros_historicos: Number(totalCountRes.data[0]?.total_filas || 0),
        resumen_ultimo_corte: {
          entidades_administradoras_activas: Number(summary.entidades_activas || 0),
          fondos_activos_unicos: Number(summary.fondos_activos || 0),
          tipos_participacion_reportados: Number(summary.participaciones_activas || 0),
          patrimonio_total_industria_cop: toNum(summary.aum_total_cop),
          patrimonio_total_industria_formateado: formatCOP(summary.aum_total_cop),
          numero_total_inversionistas: Number(summary.inversionistas_totales || 0)
        },
        ...(incluirDiccionario ? { diccionario_columnas: SFC_COLUMN_DICTIONARY } : {})
      };
    }

    case "listar_entidades_administradoras": {
      const fechaCorte = args.fecha_corte
        ? normalizeDateParam(args.fecha_corte)
        : await getLatestCutoffDate(userToken);
      const limite = Math.min(Number(args.limite || 50), 200);

      let whereClause = `fecha_corte = '${fechaCorte}'`;
      if (args.tipo_entidad_filtro) {
        const cleanFiltro = String(args.tipo_entidad_filtro).toUpperCase().replace(/'/g, "");
        whereClause += ` AND upper(nombre_tipo_entidad) like '%${cleanFiltro}%'`;
      }

      const res = await querySocrata(
        {
          $select:
            "codigo_entidad, nombre_entidad, nombre_tipo_entidad, count(distinct codigo_negocio) as total_fondos, count(*) as total_participaciones, sum(valor_fondo_cierre_dia_t) as aum_total_cop, sum(numero_inversionistas) as total_inversionistas",
          $where: whereClause,
          $group: "codigo_entidad, nombre_entidad, nombre_tipo_entidad",
          $order: "aum_total_cop DESC",
          $limit: String(limite)
        },
        { userToken, ttlSeconds: 900 }
      );

      return {
        fecha_corte: fechaCorte,
        total_entidades_retornadas: res.data.length,
        entidades: res.data.map((row: any, idx: number) => ({
          ranking_aum: idx + 1,
          codigo_entidad: row.codigo_entidad,
          nombre_entidad: row.nombre_entidad,
          tipo_entidad: row.nombre_tipo_entidad,
          total_fondos: Number(row.total_fondos || 0),
          total_participaciones: Number(row.total_participaciones || 0),
          aum_total_cop: toNum(row.aum_total_cop),
          aum_formateado: formatCOP(row.aum_total_cop),
          total_inversionistas: Number(row.total_inversionistas || 0)
        }))
      };
    }

    case "buscar_fondos_fic": {
      const fechaCorte = args.fecha_corte
        ? normalizeDateParam(args.fecha_corte)
        : await getLatestCutoffDate(userToken);
      const limite = Math.min(Number(args.limite || 30), 200);

      const conditions: string[] = [`fecha_corte = '${fechaCorte}'`];
      if (args.codigo_entidad) {
        conditions.push(`codigo_entidad = '${String(args.codigo_entidad).replace(/'/g, "")}'`);
      }
      if (args.codigo_negocio) {
        conditions.push(`codigo_negocio = '${String(args.codigo_negocio).replace(/'/g, "")}'`);
      }
      if (args.subtipo_patrimonio) {
        const sub = String(args.subtipo_patrimonio).toUpperCase().replace(/'/g, "");
        conditions.push(`upper(nombre_subtipo_patrimonio) like '%${sub}%'`);
      }
      if (args.texto_busqueda) {
        const q = String(args.texto_busqueda).toUpperCase().replace(/'/g, "");
        conditions.push(
          `(upper(nombre_patrimonio) like '%${q}%' OR upper(nombre_entidad) like '%${q}%')`
        );
      }

      const res = await querySocrata(
        {
          $select:
            "codigo_entidad, nombre_entidad, codigo_negocio, nombre_patrimonio, nombre_subtipo_patrimonio, tipo_participacion, valor_fondo_cierre_dia_t, valor_unidad_operaciones, numero_inversionistas, rentabilidad_diaria, rentabilidad_mensual, rentabilidad_semestral, rentabilidad_anual",
          $where: conditions.join(" AND "),
          $order: "valor_fondo_cierre_dia_t DESC",
          $limit: String(limite)
        },
        { userToken, ttlSeconds: 600 }
      );

      return {
        fecha_corte: fechaCorte,
        filtros_aplicados: args,
        resultados_encontrados: res.data.length,
        fondos: res.data.map((r: any) => ({
          codigo_negocio: r.codigo_negocio,
          nombre_patrimonio: r.nombre_patrimonio,
          subtipo_patrimonio: r.nombre_subtipo_patrimonio,
          codigo_entidad: r.codigo_entidad,
          nombre_entidad: r.nombre_entidad,
          tipo_participacion: r.tipo_participacion,
          aum_cierre_cop: toNum(r.valor_fondo_cierre_dia_t),
          aum_formateado: formatCOP(r.valor_fondo_cierre_dia_t),
          valor_unidad_operaciones: toNum(r.valor_unidad_operaciones),
          numero_inversionistas: Number(r.numero_inversionistas || 0),
          rentabilidades_ea_pct: {
            diaria: toNum(r.rentabilidad_diaria),
            mensual_30d: toNum(r.rentabilidad_mensual),
            semestral_180d: toNum(r.rentabilidad_semestral),
            anual_365d: toNum(r.rentabilidad_anual)
          }
        }))
      };
    }

    case "radiografia_fondo": {
      const fechaCorte = args.fecha_corte
        ? normalizeDateParam(args.fecha_corte)
        : await getLatestCutoffDate(userToken);

      const conditions: string[] = [
        `fecha_corte = '${fechaCorte}'`,
        `codigo_negocio = '${String(args.codigo_negocio).replace(/'/g, "")}'`
      ];
      if (args.codigo_entidad) {
        conditions.push(`codigo_entidad = '${String(args.codigo_entidad).replace(/'/g, "")}'`);
      }
      if (args.tipo_participacion) {
        conditions.push(
          `tipo_participacion = '${String(args.tipo_participacion).replace(/'/g, "")}'`
        );
      }

      const res = await querySocrata(
        {
          $where: conditions.join(" AND "),
          $order: "valor_fondo_cierre_dia_t DESC",
          $limit: "100"
        },
        { userToken, ttlSeconds: 600 }
      );

      if (res.data.length === 0) {
        return {
          encontrado: false,
          mensaje: `No se encontraron registros para codigo_negocio=${args.codigo_negocio} en fecha_corte=${fechaCorte}.`
        };
      }

      const first = res.data[0];
      let aumTotal = 0;
      let invTotal = 0;
      let aportesTotal = 0;
      let retirosTotal = 0;
      let rendimientosTotal = 0;

      const participaciones = res.data.map((r: any) => {
        const aum = toNum(r.valor_fondo_cierre_dia_t);
        const inv = Number(r.numero_inversionistas || 0);
        const ap = toNum(r.aportes_recibidos);
        const ret = toNum(r.retiros_redenciones);
        const anul = toNum(r.anulaciones);
        const rend = toNum(r.rendimientos_abonados);

        aumTotal += aum;
        invTotal += inv;
        aportesTotal += ap;
        retirosTotal += ret;
        rendimientosTotal += rend;

        return {
          tipo_participacion: r.tipo_participacion,
          principal_compartimento: r.principal_compartimento,
          valor_unidad_operaciones: toNum(r.valor_unidad_operaciones),
          numero_unidades_cierre: toNum(r.numero_unidades_fondo_cierre),
          aum_cierre_cop: aum,
          aum_formateado: formatCOP(aum),
          numero_inversionistas: inv,
          ticket_promedio_inversionista_cop: inv > 0 ? Math.round(aum / inv) : 0,
          ticket_promedio_formateado: inv > 0 ? formatCOP(aum / inv) : "N/A",
          flujos_dia_t: {
            aportes_recibidos_cop: ap,
            retiros_redenciones_cop: ret,
            anulaciones_cop: anul,
            flujo_neto_cop: ap - ret - anul,
            rendimientos_abonados_cop: rend
          },
          rentabilidades_ea_pct: {
            diaria: toNum(r.rentabilidad_diaria),
            mensual_30d: toNum(r.rentabilidad_mensual),
            semestral_180d: toNum(r.rentabilidad_semestral),
            anual_365d: toNum(r.rentabilidad_anual)
          }
        };
      });

      return {
        encontrado: true,
        fecha_corte: fechaCorte,
        ficha_institucional: {
          codigo_negocio: first.codigo_negocio,
          nombre_patrimonio: first.nombre_patrimonio,
          tipo_patrimonio: first.nombre_tipo_patrimonio,
          subtipo_patrimonio: first.nombre_subtipo_patrimonio,
          codigo_entidad: first.codigo_entidad,
          nombre_entidad: first.nombre_entidad,
          tipo_entidad: first.nombre_tipo_entidad
        },
        consolidado_fondo: {
          total_tipos_participacion: participaciones.length,
          aum_total_fondo_cop: aumTotal,
          aum_total_formateado: formatCOP(aumTotal),
          total_inversionistas: invTotal,
          ticket_promedio_global_cop: invTotal > 0 ? Math.round(aumTotal / invTotal) : 0,
          aportes_dia_total_cop: aportesTotal,
          retiros_dia_total_cop: retirosTotal,
          flujo_neto_dia_cop: aportesTotal - retirosTotal,
          rendimientos_abonados_dia_cop: rendimientosTotal
        },
        desglose_participaciones: participaciones
      };
    }

    case "ranking_rentabilidades_fics": {
      const fechaCorte = args.fecha_corte
        ? normalizeDateParam(args.fecha_corte)
        : await getLatestCutoffDate(userToken);
      const horizonte = [
        "rentabilidad_diaria",
        "rentabilidad_mensual",
        "rentabilidad_semestral",
        "rentabilidad_anual"
      ].includes(args.horizonte)
        ? args.horizonte
        : "rentabilidad_anual";
      const orden = args.orden === "ASC" ? "ASC" : "DESC";
      const aumMinimo = Number(args.aum_minimo_cop ?? 1000000000);
      const limite = Math.min(Number(args.limite || 20), 100);

      const conditions: string[] = [
        `fecha_corte = '${fechaCorte}'`,
        `valor_fondo_cierre_dia_t >= ${aumMinimo}`,
        `${horizonte} IS NOT NULL`
      ];

      if (args.subtipo_patrimonio) {
        const sub = String(args.subtipo_patrimonio).toUpperCase().replace(/'/g, "");
        conditions.push(`upper(nombre_subtipo_patrimonio) like '%${sub}%'`);
      }
      if (args.nombre_entidad) {
        const ent = String(args.nombre_entidad).toUpperCase().replace(/'/g, "");
        conditions.push(`upper(nombre_entidad) like '%${ent}%'`);
      }

      const res = await querySocrata(
        {
          $select:
            "codigo_negocio, nombre_patrimonio, nombre_entidad, nombre_subtipo_patrimonio, tipo_participacion, valor_fondo_cierre_dia_t, numero_inversionistas, rentabilidad_diaria, rentabilidad_mensual, rentabilidad_semestral, rentabilidad_anual",
          $where: conditions.join(" AND "),
          $order: `${horizonte} ${orden}`,
          $limit: String(limite)
        },
        { userToken, ttlSeconds: 600 }
      );

      return {
        fecha_corte: fechaCorte,
        criterio_ordenamiento: `${horizonte} (${orden})`,
        aum_minimo_filtro_cop: aumMinimo,
        ranking: res.data.map((r: any, i: number) => ({
          posicion: i + 1,
          codigo_negocio: r.codigo_negocio,
          nombre_patrimonio: r.nombre_patrimonio,
          tipo_participacion: r.tipo_participacion,
          nombre_entidad: r.nombre_entidad,
          subtipo_patrimonio: r.nombre_subtipo_patrimonio,
          rentabilidad_criterio_ea_pct: toNum(r[horizonte]),
          curva_rentabilidades_ea_pct: {
            diaria: toNum(r.rentabilidad_diaria),
            mensual_30d: toNum(r.rentabilidad_mensual),
            semestral_180d: toNum(r.rentabilidad_semestral),
            anual_365d: toNum(r.rentabilidad_anual)
          },
          aum_cierre_cop: toNum(r.valor_fondo_cierre_dia_t),
          aum_formateado: formatCOP(r.valor_fondo_cierre_dia_t),
          numero_inversionistas: Number(r.numero_inversionistas || 0)
        }))
      };
    }

    case "cuota_mercado_aum_entidades": {
      const fechaCorte = args.fecha_corte
        ? normalizeDateParam(args.fecha_corte)
        : await getLatestCutoffDate(userToken);
      const agruparPor = args.agrupar_por || "entidad";
      const limite = Math.min(Number(args.limite || 30), 100);

      let groupFields = "codigo_entidad, nombre_entidad, nombre_tipo_entidad";
      if (agruparPor === "subtipo_patrimonio") {
        groupFields = "nombre_subtipo_patrimonio";
      } else if (agruparPor === "tipo_entidad") {
        groupFields = "nombre_tipo_entidad";
      }

      const conditions: string[] = [`fecha_corte = '${fechaCorte}'`];
      if (args.subtipo_patrimonio) {
        const sub = String(args.subtipo_patrimonio).toUpperCase().replace(/'/g, "");
        conditions.push(`upper(nombre_subtipo_patrimonio) like '%${sub}%'`);
      }

      const res = await querySocrata(
        {
          $select: `${groupFields}, count(distinct codigo_negocio) as fondos_unicos, sum(valor_fondo_cierre_dia_t) as aum_cop, sum(numero_inversionistas) as inversionistas, sum(aportes_recibidos) as aportes_cop, sum(retiros_redenciones) as retiros_cop`,
          $where: conditions.join(" AND "),
          $group: groupFields,
          $order: "aum_cop DESC",
          $limit: "200"
        },
        { userToken, ttlSeconds: 900 }
      );

      const totalIndustriaAum = res.data.reduce((acc, r: any) => acc + toNum(r.aum_cop), 0);
      const totalIndustriaInv = res.data.reduce(
        (acc, r: any) => acc + Number(r.inversionistas || 0),
        0
      );

      let acumuladoPct = 0;
      const items = res.data.slice(0, limite).map((r: any, idx: number) => {
        const aum = toNum(r.aum_cop);
        const sharePct = totalIndustriaAum > 0 ? (aum / totalIndustriaAum) * 100 : 0;
        acumuladoPct += sharePct;
        return {
          posicion: idx + 1,
          ...(r.nombre_entidad
            ? {
                codigo_entidad: r.codigo_entidad,
                nombre_entidad: r.nombre_entidad,
                tipo_entidad: r.nombre_tipo_entidad
              }
            : {}),
          ...(r.nombre_subtipo_patrimonio
            ? { subtipo_patrimonio: r.nombre_subtipo_patrimonio }
            : {}),
          ...(agruparPor === "tipo_entidad" ? { tipo_entidad: r.nombre_tipo_entidad } : {}),
          fondos_activos: Number(r.fondos_unicos || 0),
          aum_cop: aum,
          aum_formateado: formatCOP(aum),
          market_share_aum_pct: Number(sharePct.toFixed(2)),
          market_share_acumulado_pct: Number(acumuladoPct.toFixed(2)),
          inversionistas: Number(r.inversionistas || 0),
          flujo_neto_dia_cop: toNum(r.aportes_cop) - toNum(r.retiros_cop)
        };
      });

      return {
        fecha_corte: fechaCorte,
        agrupado_por: agruparPor,
        aum_total_universo_cop: totalIndustriaAum,
        aum_total_universo_formateado: formatCOP(totalIndustriaAum),
        inversionistas_totales_universo: totalIndustriaInv,
        tabla_market_share: items
      };
    }

    case "flujos_netos_captacion": {
      const fechaInicio = normalizeDateParam(args.fecha_inicio);
      const fechaFin = args.fecha_fin
        ? normalizeDateParam(args.fecha_fin)
        : await getLatestCutoffDate(userToken);
      const nivel = args.nivel_agrupacion === "fondo" ? "fondo" : "entidad";
      const limite = Math.min(Number(args.limite || 25), 100);

      const conditions: string[] = [
        `fecha_corte >= '${fechaInicio}'`,
        `fecha_corte <= '${fechaFin}'`
      ];
      if (args.codigo_entidad) {
        conditions.push(`codigo_entidad = '${String(args.codigo_entidad).replace(/'/g, "")}'`);
      }

      const groupBy =
        nivel === "fondo"
          ? "codigo_negocio, nombre_patrimonio, nombre_entidad, nombre_subtipo_patrimonio"
          : "codigo_entidad, nombre_entidad, nombre_tipo_entidad";

      const res = await querySocrata(
        {
          $select: `${groupBy}, sum(aportes_recibidos) as total_aportes, sum(retiros_redenciones) as total_retiros, sum(anulaciones) as total_anulaciones, sum(rendimientos_abonados) as total_rendimientos`,
          $where: conditions.join(" AND "),
          $group: groupBy,
          $limit: "500"
        },
        { userToken, ttlSeconds: 600 }
      );

      const enriched = res.data.map((r: any) => {
        const ap = toNum(r.total_aportes);
        const ret = toNum(r.total_retiros);
        const anul = toNum(r.total_anulaciones);
        const neto = ap - ret - anul;
        return {
          ...(nivel === "fondo"
            ? {
                codigo_negocio: r.codigo_negocio,
                nombre_patrimonio: r.nombre_patrimonio,
                nombre_entidad: r.nombre_entidad,
                subtipo_patrimonio: r.nombre_subtipo_patrimonio
              }
            : {
                codigo_entidad: r.codigo_entidad,
                nombre_entidad: r.nombre_entidad,
                tipo_entidad: r.nombre_tipo_entidad
              }),
          aportes_recibidos_cop: ap,
          retiros_redenciones_cop: ret,
          anulaciones_cop: anul,
          flujo_neto_captacion_cop: neto,
          flujo_neto_formateado: formatCOP(neto),
          rendimientos_abonados_periodo_cop: toNum(r.total_rendimientos)
        };
      });

      enriched.sort((a, b) =>
        args.orden === "MAYOR_SALIDA"
          ? a.flujo_neto_captacion_cop - b.flujo_neto_captacion_cop
          : b.flujo_neto_captacion_cop - a.flujo_neto_captacion_cop
      );

      return {
        ventana_analisis: { fecha_inicio: fechaInicio, fecha_fin: fechaFin },
        nivel_agrupacion: nivel,
        orden: args.orden || "MAYOR_CAPTACION",
        resultados: enriched.slice(0, limite)
      };
    }

    case "radar_corridas_y_alertas_liquidez": {
      const fechaCorte = args.fecha_corte
        ? normalizeDateParam(args.fecha_corte)
        : await getLatestCutoffDate(userToken);
      const umbralPct = Number(args.umbral_retiro_pct ?? 5);
      const aumMinimo = Number(args.aum_minimo_cop ?? 5000000000);
      const limite = Math.min(Number(args.limite || 25), 100);

      const res = await querySocrata(
        {
          $select:
            "codigo_negocio, nombre_patrimonio, tipo_participacion, nombre_entidad, nombre_subtipo_patrimonio, precierre_fondo_dia_t, aportes_recibidos, retiros_redenciones, valor_fondo_cierre_dia_t, numero_inversionistas, rentabilidad_diaria, rentabilidad_mensual",
          $where: `fecha_corte = '${fechaCorte}' AND precierre_fondo_dia_t >= ${aumMinimo} AND retiros_redenciones > 0`,
          $order: "retiros_redenciones DESC",
          $limit: "300"
        },
        { userToken, ttlSeconds: 600 }
      );

      const alertas = res.data
        .map((r: any) => {
          const precierre = toNum(r.precierre_fondo_dia_t);
          const retiros = toNum(r.retiros_redenciones);
          const aportes = toNum(r.aportes_recibidos);
          const retiroBrutoPct = precierre > 0 ? (retiros / precierre) * 100 : 0;
          const salidaNetaPct = precierre > 0 ? ((retiros - aportes) / precierre) * 100 : 0;
          return {
            codigo_negocio: r.codigo_negocio,
            nombre_patrimonio: r.nombre_patrimonio,
            tipo_participacion: r.tipo_participacion,
            nombre_entidad: r.nombre_entidad,
            subtipo_patrimonio: r.nombre_subtipo_patrimonio,
            precierre_cop: precierre,
            retiros_redenciones_cop: retiros,
            aportes_recibidos_cop: aportes,
            cierre_final_cop: toNum(r.valor_fondo_cierre_dia_t),
            retiro_bruto_sobre_precierre_pct: Number(retiroBrutoPct.toFixed(2)),
            salida_neta_sobre_precierre_pct: Number(salidaNetaPct.toFixed(2)),
            severidad_alerta:
              salidaNetaPct >= 15
                ? "CRITICA_CORRIDA"
                : salidaNetaPct >= 8
                ? "ALTA"
                : "MODERADA",
            numero_inversionistas: Number(r.numero_inversionistas || 0),
            rentabilidad_diaria_ea_pct: toNum(r.rentabilidad_diaria)
          };
        })
        .filter((a) => a.retiro_bruto_sobre_precierre_pct >= umbralPct)
        .sort(
          (a, b) => b.salida_neta_sobre_precierre_pct - a.salida_neta_sobre_precierre_pct
        )
        .slice(0, limite);

      return {
        fecha_corte: fechaCorte,
        umbral_retiro_pct_configurado: umbralPct,
        aum_minimo_cop: aumMinimo,
        total_alertas_detectadas: alertas.length,
        alertas_liquidez: alertas
      };
    }

    case "serie_historica_nav_y_tasas": {
      const fechaInicio = normalizeDateParam(args.fecha_inicio);
      const fechaFin = args.fecha_fin
        ? normalizeDateParam(args.fecha_fin)
        : await getLatestCutoffDate(userToken);
      const limite = Math.min(Number(args.limite || 365), 2000);

      let tipoParticipacion = args.tipo_participacion;
      if (!tipoParticipacion) {
        const latestRes = await querySocrata(
          {
            $select: "tipo_participacion, valor_fondo_cierre_dia_t",
            $where: `codigo_negocio = '${String(args.codigo_negocio).replace(/'/g, "")}' AND fecha_corte <= '${fechaFin}'`,
            $order: "fecha_corte DESC, valor_fondo_cierre_dia_t DESC",
            $limit: "1"
          },
          { userToken, ttlSeconds: 600 }
        );
        tipoParticipacion = latestRes.data[0]?.tipo_participacion;
      }

      const conditions: string[] = [
        `codigo_negocio = '${String(args.codigo_negocio).replace(/'/g, "")}'`,
        `fecha_corte >= '${fechaInicio}'`,
        `fecha_corte <= '${fechaFin}'`
      ];
      if (tipoParticipacion) {
        conditions.push(`tipo_participacion = '${String(tipoParticipacion).replace(/'/g, "")}'`);
      }
      if (args.codigo_entidad) {
        conditions.push(`codigo_entidad = '${String(args.codigo_entidad).replace(/'/g, "")}'`);
      }

      const res = await querySocrata(
        {
          $select:
            "fecha_corte, nombre_patrimonio, nombre_entidad, tipo_participacion, valor_unidad_operaciones, valor_fondo_cierre_dia_t, numero_inversionistas, aportes_recibidos, retiros_redenciones, rentabilidad_diaria, rentabilidad_mensual, rentabilidad_semestral, rentabilidad_anual",
          $where: conditions.join(" AND "),
          $order: "fecha_corte ASC",
          $limit: String(limite)
        },
        { userToken, ttlSeconds: 600 }
      );

      const rawSeries = res.data;
      const freq = args.frecuencia_muestreo || "diaria";
      const sampled = rawSeries.filter((_, index) => {
        if (freq === "semanal") return index % 7 === 0 || index === rawSeries.length - 1;
        if (freq === "mensual") return index % 30 === 0 || index === rawSeries.length - 1;
        return true;
      });

      return {
        codigo_negocio: args.codigo_negocio,
        nombre_patrimonio: rawSeries[0]?.nombre_patrimonio || "N/A",
        nombre_entidad: rawSeries[0]?.nombre_entidad || "N/A",
        tipo_participacion_seleccionada: tipoParticipacion,
        frecuencia_muestreo: freq,
        observaciones_totales: rawSeries.length,
        observaciones_entregadas: sampled.length,
        serie_tiempo: sampled.map((r: any) => ({
          fecha: String(r.fecha_corte).split("T")[0],
          valor_unidad: toNum(r.valor_unidad_operaciones),
          aum_cop: toNum(r.valor_fondo_cierre_dia_t),
          inversionistas: Number(r.numero_inversionistas || 0),
          flujo_neto_cop: toNum(r.aportes_recibidos) - toNum(r.retiros_redenciones),
          rentabilidad_anual_ea_pct: toNum(r.rentabilidad_anual)
        }))
      };
    }

    case "metricas_riesgo_cuantitativo": {
      const serieRes = await executeMcpTool(
        "serie_historica_nav_y_tasas",
        {
          codigo_negocio: args.codigo_negocio,
          tipo_participacion: args.tipo_participacion,
          codigo_entidad: args.codigo_entidad,
          fecha_inicio: args.fecha_inicio,
          fecha_fin: args.fecha_fin,
          frecuencia_muestreo: "diaria",
          limite: 1500
        },
        userToken
      );

      const pts = (serieRes.serie_tiempo || []).filter((p: any) => p.valor_unidad > 0);
      if (pts.length < 2) {
        return {
          error: "No hay suficientes observaciones de valor_unidad_operaciones para calcular métricas de riesgo cuantitativo.",
          observaciones_encontradas: pts.length
        };
      }

      const first = pts[0];
      const last = pts[pts.length - 1];
      const d0 = new Date(first.fecha).getTime();
      const dT = new Date(last.fecha).getTime();
      const calendarDays = Math.max(1, (dT - d0) / (1000 * 60 * 60 * 24));

      const totalReturn = last.valor_unidad / first.valor_unidad - 1;
      const cagrEa = Math.pow(last.valor_unidad / first.valor_unidad, 365 / calendarDays) - 1;

      const dailyReturns: number[] = [];
      let peak = pts[0].valor_unidad;
      let maxDrawdown = 0;
      let peakDate = pts[0].fecha;
      let troughDate = pts[0].fecha;
      let currentPeakDate = pts[0].fecha;

      for (let i = 1; i < pts.length; i++) {
        const prev = pts[i - 1].valor_unidad;
        const curr = pts[i].valor_unidad;
        const r = curr / prev - 1;
        dailyReturns.push(r);

        if (curr > peak) {
          peak = curr;
          currentPeakDate = pts[i].fecha;
        }
        const dd = (curr - peak) / peak;
        if (dd < maxDrawdown) {
          maxDrawdown = dd;
          peakDate = currentPeakDate;
          troughDate = pts[i].fecha;
        }
      }

      const n = dailyReturns.length;
      const meanDaily = dailyReturns.reduce((a, b) => a + b, 0) / n;
      const varianceDaily =
        dailyReturns.reduce((acc, r) => acc + Math.pow(r - meanDaily, 2), 0) /
        Math.max(1, n - 1);
      const stdDaily = Math.sqrt(varianceDaily);
      const annualizedVol = stdDaily * Math.sqrt(365);

      const rfEa = Number(args.tasa_libre_riesgo_ea_pct ?? 9.5) / 100;
      const rfDaily = Math.pow(1 + rfEa, 1 / 365) - 1;

      const downsideSquares = dailyReturns.map((r) =>
        r < rfDaily ? Math.pow(r - rfDaily, 2) : 0
      );
      const downsideDevDaily = Math.sqrt(
        downsideSquares.reduce((a, b) => a + b, 0) / Math.max(1, n)
      );
      const annualizedDownsideVol = downsideDevDaily * Math.sqrt(365);

      const sharpeRatio =
        annualizedVol > 0 ? (cagrEa - rfEa) / annualizedVol : 0;
      const sortinoRatio =
        annualizedDownsideVol > 0 ? (cagrEa - rfEa) / annualizedDownsideVol : 0;

      const flujosNetosPeriodo = pts.reduce(
        (acc: number, p: any) => acc + (p.flujo_neto_cop || 0),
        0
      );

      return {
        codigo_negocio: args.codigo_negocio,
        nombre_patrimonio: serieRes.nombre_patrimonio,
        nombre_entidad: serieRes.nombre_entidad,
        tipo_participacion: serieRes.tipo_participacion_seleccionada,
        periodo_evaluado: {
          fecha_inicial: first.fecha,
          fecha_final: last.fecha,
          dias_calendario: Math.round(calendarDays),
          observaciones_diarias: pts.length
        },
        metricas_valor_unidad: {
          valor_unidad_inicial: first.valor_unidad,
          valor_unidad_final: last.valor_unidad,
          retorno_acumulado_periodo_pct: Number((totalReturn * 100).toFixed(4)),
          rentabilidad_efectiva_anual_cagr_pct: Number((cagrEa * 100).toFixed(4))
        },
        metricas_riesgo: {
          volatilidad_anualizada_pct: Number((annualizedVol * 100).toFixed(4)),
          maximum_drawdown_pct: Number((maxDrawdown * 100).toFixed(4)),
          fecha_pico_drawdown: peakDate,
          fecha_valle_drawdown: troughDate,
          tasa_libre_riesgo_referencia_ea_pct: Number((rfEa * 100).toFixed(2)),
          sharpe_ratio: Number(sharpeRatio.toFixed(3)),
          sortino_ratio: Number(sortinoRatio.toFixed(3)),
          dias_positivos_pct: Number(
            ((dailyReturns.filter((r) => r > 0).length / n) * 100).toFixed(2)
          )
        },
        evolucion_patrimonial: {
          aum_inicial_cop: first.aum_cop,
          aum_final_cop: last.aum_cop,
          aum_final_formateado: formatCOP(last.aum_cop),
          flujo_neto_acumulado_cop: flujosNetosPeriodo,
          flujo_neto_acumulado_formateado: formatCOP(flujosNetosPeriodo),
          inversionistas_inicial: first.inversionistas,
          inversionistas_final: last.inversionistas
        }
      };
    }

    case "comparar_peer_group_fics": {
      const fechaCorte = args.fecha_corte
        ? normalizeDateParam(args.fecha_corte)
        : await getLatestCutoffDate(userToken);
      const codigos: string[] = Array.isArray(args.codigos_negocio)
        ? args.codigos_negocio.map((c: any) => `'${String(c).replace(/'/g, "")}'`)
        : [];

      if (codigos.length === 0) {
        throw new Error("Debe proporcionar al menos un código en codigos_negocio.");
      }

      const res = await querySocrata(
        {
          $where: `fecha_corte = '${fechaCorte}' AND codigo_negocio IN (${codigos.join(",")})`,
          $order: "valor_fondo_cierre_dia_t DESC",
          $limit: "200"
        },
        { userToken, ttlSeconds: 600 }
      );

      const grouped = new Map<string, any>();
      for (const r of res.data) {
        const code = String(r.codigo_negocio);
        if (!grouped.has(code)) {
          grouped.set(code, {
            codigo_negocio: code,
            nombre_patrimonio: r.nombre_patrimonio,
            nombre_entidad: r.nombre_entidad,
            subtipo_patrimonio: r.nombre_subtipo_patrimonio,
            aum_total_fondo_cop: 0,
            inversionistas_totales: 0,
            flujo_neto_dia_cop: 0,
            participacion_principal: {
              tipo_participacion: r.tipo_participacion,
              aum_cop: toNum(r.valor_fondo_cierre_dia_t),
              rentabilidad_diaria_ea_pct: toNum(r.rentabilidad_diaria),
              rentabilidad_mensual_ea_pct: toNum(r.rentabilidad_mensual),
              rentabilidad_semestral_ea_pct: toNum(r.rentabilidad_semestral),
              rentabilidad_anual_ea_pct: toNum(r.rentabilidad_anual)
            },
            cantidad_participaciones: 0
          });
        }
        const item = grouped.get(code)!;
        item.aum_total_fondo_cop += toNum(r.valor_fondo_cierre_dia_t);
        item.inversionistas_totales += Number(r.numero_inversionistas || 0);
        item.flujo_neto_dia_cop +=
          toNum(r.aportes_recibidos) - toNum(r.retiros_redenciones);
        item.cantidad_participaciones += 1;
      }

      const comparativa = Array.from(grouped.values()).map((f) => ({
        ...f,
        aum_total_formateado: formatCOP(f.aum_total_fondo_cop),
        ticket_promedio_cop:
          f.inversionistas_totales > 0
            ? Math.round(f.aum_total_fondo_cop / f.inversionistas_totales)
            : 0
      }));

      return {
        fecha_corte: fechaCorte,
        fondos_comparados: comparativa.length,
        peer_group: comparativa
      };
    }

    case "ejecutar_soql_avanzado": {
      const limit = Math.min(Number(args.limit || 50), 1000);
      const res = await querySocrata(
        {
          $select: args.select,
          $where: args.where,
          $group: args.group,
          $having: args.having,
          $order: args.order,
          $q: args.q,
          $limit: String(limit),
          $offset: args.offset !== undefined ? String(args.offset) : undefined
        },
        { userToken, ttlSeconds: 300 }
      );

      return {
        soql_url_ejecutada: res.soqlUrl,
        modo_token: res.tokenSource,
        desde_cache: res.cached,
        filas_retornadas: res.data.length,
        datos: res.data
      };
    }

    default:
      throw new Error(`Herramienta MCP no reconocida: ${name}`);
  }
}
