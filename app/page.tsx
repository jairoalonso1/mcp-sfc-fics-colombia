import React from "react";
import { MCP_TOOLS } from "@/lib/mcp-tools";
import { DATASET_ID, SOCRATA_BASE_URL } from "@/lib/socrata";

export default function HomePage() {
  return (
    <main style={{ maxWidth: "1000px", margin: "0 auto", padding: "48px 24px" }}>
      <div
        style={{
          display: "inline-block",
          background: "#1e293b",
          color: "#38bdf8",
          padding: "6px 14px",
          borderRadius: "999px",
          fontSize: "13px",
          fontWeight: 600,
          marginBottom: "16px"
        }}
      >
        Model Context Protocol (MCP) • Streamable HTTP (HTTPS)
      </div>

      <h1 style={{ fontSize: "36px", margin: "0 0 12px 0", color: "#ffffff" }}>
        MCP Rentabilidades FICs y FCPs Colombia (SFC)
      </h1>
      <p style={{ fontSize: "17px", color: "#94a3b8", lineHeight: 1.6, marginBottom: "32px" }}>
        Servidor MCP conectado en tiempo real al dataset oficial{" "}
        <code style={{ color: "#38bdf8" }}>{DATASET_ID}</code> de la Superintendencia Financiera
        de Colombia en Datos Abiertos (<code>{SOCRATA_BASE_URL}</code>). Incluye arquitectura
        híbrida de <strong>App Token Socrata</strong> (BYOK por usuario, variable de entorno en
        Vercel o caché inteligente en memoria).
      </p>

      <section
        style={{
          background: "#111827",
          border: "1px solid #1f2937",
          borderRadius: "12px",
          padding: "24px",
          marginBottom: "32px"
        }}
      >
        <h2 style={{ marginTop: 0, fontSize: "20px", color: "#f8fafc" }}>
          Endpoint HTTPS del Servidor MCP
        </h2>
        <pre
          style={{
            background: "#030712",
            padding: "16px",
            borderRadius: "8px",
            color: "#4ade80",
            overflowX: "auto",
            fontSize: "14px"
          }}
        >
          POST /api/mcp{"\n"}
          GET  /api/mcp (Healthcheck & especificación de herramientas)
        </pre>
        <p style={{ fontSize: "14px", color: "#94a3b8", marginBottom: 0 }}>
          Para pasar un App Token propio de <code>datos.gov.co</code>, envía el header{" "}
          <code>x-socrata-app-token: TU_TOKEN</code> o usa el query param{" "}
          <code>/api/mcp?app_token=TU_TOKEN</code>.
        </p>
      </section>

      <h2 style={{ fontSize: "22px", marginBottom: "16px" }}>
        Catálogo de {MCP_TOOLS.length} Herramientas Cuantitativas e Institucionales
      </h2>
      <div style={{ display: "grid", gap: "16px" }}>
        {MCP_TOOLS.map((tool, index) => (
          <div
            key={tool.name}
            style={{
              background: "#111827",
              border: "1px solid #1f2937",
              borderRadius: "10px",
              padding: "18px 20px"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
              <span
                style={{
                  background: "#0284c7",
                  color: "#fff",
                  borderRadius: "6px",
                  padding: "2px 8px",
                  fontSize: "12px",
                  fontWeight: 700
                }}
              >
                #{index + 1}
              </span>
              <code style={{ fontSize: "16px", fontWeight: 700, color: "#38bdf8" }}>
                {tool.name}
              </code>
            </div>
            <p style={{ margin: 0, color: "#cbd5e1", fontSize: "14px", lineHeight: 1.5 }}>
              {tool.description}
            </p>
          </div>
        ))}
      </div>
    </main>
  );
}
