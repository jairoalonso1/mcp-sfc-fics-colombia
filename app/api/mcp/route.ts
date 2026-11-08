import { NextRequest, NextResponse } from "next/server";
import { MCP_TOOLS, executeMcpTool } from "@/lib/mcp-tools";
import {
  DATASET_ID,
  SOCRATA_BASE_URL,
  SFC_COLUMN_DICTIONARY,
  resolveSocrataToken
} from "@/lib/socrata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SERVER_INFO = {
  name: "mcp-sfc-fics-colombia",
  version: "1.0.0",
  description:
    "Servidor MCP (Model Context Protocol) sobre HTTPS para análisis cuantitativo e institucional de Fondos de Inversión Colectiva (FICs) y FCPs de la Superintendencia Financiera de Colombia (datos.gov.co / qhpu-8ixx)."
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, x-socrata-app-token, X-App-Token, mcp-session-id, Accept",
  "Access-Control-Expose-Headers": "mcp-session-id"
};

function extractUserSocrataToken(req: NextRequest): string | null {
  const headerToken =
    req.headers.get("x-socrata-app-token") || req.headers.get("x-app-token");
  if (headerToken) return headerToken;

  const queryToken =
    req.nextUrl.searchParams.get("app_token") ||
    req.nextUrl.searchParams.get("socrata_token");
  if (queryToken) return queryToken;

  return null;
}

function checkMcpAuth(req: NextRequest): boolean {
  const requiredKey = process.env.MCP_API_KEY;
  if (!requiredKey || requiredKey.trim() === "") return true;

  const authHeader = req.headers.get("authorization") || "";
  const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
  const queryKey = req.nextUrl.searchParams.get("api_key") || "";

  return bearer === requiredKey.trim() || queryKey === requiredKey.trim();
}

async function handleJsonRpcMessage(
  msg: any,
  userSocrataToken: string | null
): Promise<any | null> {
  if (!msg || typeof msg !== "object") {
    return {
      jsonrpc: "2.0",
      id: null,
      error: { code: -32600, message: "Invalid Request" }
    };
  }

  const { id, method, params } = msg;

  // Notifications (sin id) no requieren respuesta JSON-RPC
  if (id === undefined || id === null) {
    if (method && String(method).startsWith("notifications/")) {
      return null;
    }
  }

  try {
    switch (method) {
      case "initialize": {
        return {
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: params?.protocolVersion || "2024-11-05",
            capabilities: {
              tools: { listChanged: false },
              resources: { subscribe: false, listChanged: false },
              prompts: { listChanged: false }
            },
            serverInfo: SERVER_INFO
          }
        };
      }

      case "ping": {
        return {
          jsonrpc: "2.0",
          id,
          result: {}
        };
      }

      case "tools/list": {
        return {
          jsonrpc: "2.0",
          id,
          result: {
            tools: MCP_TOOLS
          }
        };
      }

      case "tools/call": {
        const toolName = params?.name;
        const toolArgs = params?.arguments || {};
        if (!toolName) {
          return {
            jsonrpc: "2.0",
            id,
            error: { code: -32602, message: "Falta el parámetro 'name' en tools/call." }
          };
        }

        const output = await executeMcpTool(toolName, toolArgs, userSocrataToken);
        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: JSON.stringify(output, null, 2)
              }
            ],
            isError: false
          }
        };
      }

      case "resources/list": {
        return {
          jsonrpc: "2.0",
          id,
          result: {
            resources: [
              {
                uri: "sfc://qhpu-8ixx/diccionario",
                name: "Diccionario de Datos SFC FICs (qhpu-8ixx)",
                description:
                  "Especificación oficial de las 26 columnas del dataset de Rentabilidades de los Fondos de Inversión Colectiva (Superfinanciera / datos.gov.co).",
                mimeType: "application/json"
              }
            ]
          }
        };
      }

      case "resources/read": {
        const uri = params?.uri;
        if (uri === "sfc://qhpu-8ixx/diccionario") {
          return {
            jsonrpc: "2.0",
            id,
            result: {
              contents: [
                {
                  uri,
                  mimeType: "application/json",
                  text: JSON.stringify(
                    {
                      dataset_id: DATASET_ID,
                      endpoint: SOCRATA_BASE_URL,
                      columnas: SFC_COLUMN_DICTIONARY
                    },
                    null,
                    2
                  )
                }
              ]
            }
          };
        }
        return {
          jsonrpc: "2.0",
          id,
          error: { code: -32602, message: `Recurso no encontrado: ${uri}` }
        };
      }

      case "prompts/list": {
        return {
          jsonrpc: "2.0",
          id,
          result: {
            prompts: [
              {
                name: "comite-fics",
                description:
                  "Genera un informe institucional de comité de inversiones sobre el mercado de FICs en Colombia, incluyendo Market Share fiduciario, Top fondos por rentabilidad, flujos netos de captación y radar de alertas de liquidez.",
                arguments: [
                  {
                    name: "entidad_foco",
                    description: "Nombre de la Sociedad Fiduciaria o Comisionista a destacar (ej. Fiducoldex).",
                    required: false
                  }
                ]
              }
            ]
          }
        };
      }

      case "prompts/get": {
        const entidadFoco = params?.arguments?.entidad_foco || "Fiducoldex";
        return {
          jsonrpc: "2.0",
          id,
          result: {
            description: `Informe Ejecutivo Comité de Inversiones FICs - Foco: ${entidadFoco}`,
            messages: [
              {
                role: "user",
                content: {
                  type: "text",
                  text: `Actúa como Portfolio Manager institucional en Colombia. Usa las herramientas del servidor MCP 'mcp-sfc-fics-colombia' en este orden:
1. Llama a 'obtener_estado_dataset' para verificar la última fecha de corte disponible en la SFC.
2. Llama a 'cuota_mercado_aum_entidades' para presentar el Top 15 de Sociedades Fiduciarias/Comisionistas por AUM y analiza la posición competitiva de ${entidadFoco}.
3. Llama a 'buscar_fondos_fic' con texto_busqueda='${entidadFoco}' para detallar todos los fondos y participaciones de ${entidadFoco}, su AUM, inversionistas y rentabilidades E.A.
4. Llama a 'ranking_rentabilidades_fics' para comparar contra los líderes del mercado y 'radar_corridas_y_alertas_liquidez' para reportar cualquier tensión de liquidez en la industria.`
                }
              }
            ]
          }
        };
      }

      default:
        return {
          jsonrpc: "2.0",
          id,
          error: {
            code: -32601,
            message: `Método JSON-RPC no soportado: ${method}`
          }
        };
    }
  } catch (err: any) {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                error: true,
                mensaje: err?.message || String(err)
              },
              null,
              2
            )
          }
        ],
        isError: true
      }
    };
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(req: NextRequest) {
  if (!checkMcpAuth(req)) {
    return NextResponse.json(
      { error: "Unauthorized. Provide valid Bearer token or api_key." },
      { status: 401, headers: CORS_HEADERS }
    );
  }

  const userToken = extractUserSocrataToken(req);
  const tokenStatus = resolveSocrataToken(userToken);

  return NextResponse.json(
    {
      status: "online",
      protocol: "Model Context Protocol (MCP) - Streamable HTTP (JSON-RPC 2.0)",
      server: SERVER_INFO,
      dataset: {
        id: DATASET_ID,
        source: "Superintendencia Financiera de Colombia (SFC) - datos.gov.co",
        socrata_endpoint: SOCRATA_BASE_URL
      },
      socrata_token_mode: tokenStatus.source,
      tools_count: MCP_TOOLS.length,
      tools: MCP_TOOLS.map((t) => ({ name: t.name, description: t.description })),
      usage: {
        mcp_endpoint: `${req.nextUrl.origin}/api/mcp`,
        byok_header_optional: "x-socrata-app-token: <TU_APP_TOKEN_DATOS_GOV_CO>",
        byok_query_optional: `${req.nextUrl.origin}/api/mcp?app_token=<TU_APP_TOKEN_DATOS_GOV_CO>`
      }
    },
    { status: 200, headers: CORS_HEADERS }
  );
}

export async function POST(req: NextRequest) {
  if (!checkMcpAuth(req)) {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32001, message: "Unauthorized MCP request" }
      },
      { status: 401, headers: CORS_HEADERS }
    );
  }

  const userToken = extractUserSocrataToken(req);

  try {
    const body = await req.json();

    if (Array.isArray(body)) {
      const responses = (
        await Promise.all(body.map((msg) => handleJsonRpcMessage(msg, userToken)))
      ).filter((r) => r !== null);

      if (responses.length === 0) {
        return new NextResponse(null, { status: 202, headers: CORS_HEADERS });
      }
      return NextResponse.json(responses, { status: 200, headers: CORS_HEADERS });
    }

    const response = await handleJsonRpcMessage(body, userToken);
    if (response === null) {
      return new NextResponse(null, { status: 202, headers: CORS_HEADERS });
    }

    return NextResponse.json(response, { status: 200, headers: CORS_HEADERS });
  } catch (err: any) {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32700,
          message: `Parse error: ${err?.message || String(err)}`
        }
      },
      { status: 400, headers: CORS_HEADERS }
    );
  }
}
