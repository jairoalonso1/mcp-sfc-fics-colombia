import React from "react";

export const metadata = {
  title: "MCP SFC FICs Colombia | datos.gov.co (qhpu-8ixx)",
  description:
    "Servidor MCP (Model Context Protocol) sobre HTTPS para análisis cuantitativo e institucional de Fondos de Inversión Colectiva (FICs) en Colombia."
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          backgroundColor: "#0b0f19",
          color: "#f8fafc"
        }}
      >
        {children}
      </body>
    </html>
  );
}
