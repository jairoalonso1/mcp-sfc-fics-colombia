# mcp-sfc-fics-colombia

Servidor **MCP (Model Context Protocol)** sobre HTTPS para análisis cuantitativo, institucional y de gestión de riesgos de **Fondos de Inversión Colectiva (FICs)** y **Fondos de Capital Privado (FCPs)** vigilados por la **Superintendencia Financiera de Colombia (SFC)** a través del dataset oficial de Datos Abiertos (`qhpu-8ixx` en `datos.gov.co`).

---

## 🚀 Características Principales

* **Transporte HTTPS / Streamable HTTP:** Conectividad nativa vía JSON-RPC 2.0 y SSE compatible con clientes LLM modernos (Gemini, Claude Desktop, Cursor).
* **Arquitectura Híbrida de App Token Socrata:** Soporte para token de usuario (BYOK), variable de entorno en Vercel (`SOCRATA_APP_TOKEN`) o modo público optimizado con caché en memoria (TTL de 10 minutos) para prevenir límites de tasa (`HTTP 429`).
* **12 Herramientas Cuantitativas e Institucionales:** Cobertura completa desde exploración macro de la industria hasta métricas de riesgo avanzadas (CAGR, Volatilidad, Sharpe, Sortino, Max Drawdown) y auditoría de flujos de caja.

---

## 🛠️ Catálogo Detallado de las 12 Herramientas del MCP

### 1. `obtener_estado_dataset`
* **Descripción:** Consulta el estado actual del dataset oficial `qhpu-8ixx` en la Superfinanciera. Retorna la última fecha de corte disponible, el total de registros históricos, la cantidad de entidades activas, fondos y participaciones únicas, el AUM total de la industria, el número total de inversionistas y el diccionario técnico completo de las 26 columnas.
* **Parámetros:** `incluir_diccionario` (booleano, opcional, por defecto `true`).

### 2. `listar_entidades_administradoras`
* **Descripción:** Lista todas las Sociedades Fiduciarias, Sociedades Comisionistas de Bolsa (SCB) y Sociedades Administradoras de Inversión (SAI) activas en una fecha de corte, ordenadas por patrimonio administrado (AUM en COP). Muestra su código SFC, nombre, tipo de entidad, número de FICs, cantidad de participaciones, AUM total y número de inversionistas.
* **Parámetros:** `fecha_corte` (YYYY-MM-DD, opcional), `tipo_entidad_filtro` (texto, opcional), `limite` (número, por defecto 50).

### 3. `buscar_fondos_fic`
* **Descripción:** Buscador inteligente por palabra clave (`$q`) de FICs o FCPs por nombre del fondo, fiduciaria, código de negocio (`codigo_negocio`) o subtipo de patrimonio (ej. `FIC DE TIPO GENERAL`, `FONDO BURSATIL`, `INMOBILIARIO`, `CAPITAL PRIVADO`). Devuelve clases de participación activas, AUM, NAV y rentabilidades recientes.
* **Parámetros:** `texto_busqueda` (string), `codigo_entidad` (string), `codigo_negocio` (string), `subtipo_patrimonio` (string), `fecha_corte` (YYYY-MM-DD), `limite` (número).

### 4. `radiografia_fondo`
* **Descripción:** Entrega la ficha institucional completa de un fondo específico por su `codigo_negocio` en la fecha más reciente: desglose de todas sus clases y tipos de participación, AUM total del fondo, valor de unidad operativo (NAV), número de inversionistas, ticket promedio por inversionista ($AUM / Inversionistas$), flujos netos del día, rendimientos abonados y curva completa de rentabilidades E.A. (diaria, 30d, 180d, 365d).
* **Parámetros:** `codigo_negocio` (string, requerido), `codigo_entidad` (string, opcional), `tipo_participacion` (string, opcional), `fecha_corte` (YYYY-MM-DD, opcional).

### 5. `ranking_rentabilidades_fics`
* **Descripción:** Genera el Top N o Bottom N de los FICs según su rentabilidad Efectiva Anual (diaria, mensual, semestral o anual) en una fecha de corte. Permite filtrar por subtipo de patrimonio, entidad y establecer un patrimonio mínimo (`aum_minimo_cop`) para excluir fondos pequeños o anomalías estadísticas.
* **Parámetros:** `horizonte` (`rentabilidad_diaria`, `rentabilidad_mensual`, `rentabilidad_semestral`, `rentabilidad_anual`), `orden` (`DESC` o `ASC`), `subtipo_patrimonio`, `nombre_entidad`, `aum_minimo_cop`, `fecha_corte`, `limite`.

### 6. `cuota_mercado_aum_entidades`
* **Descripción:** Calcula el Market Share (cuota de mercado porcentual) de la industria fiduciaria y comisionista agrupado por entidad administradora, subtipo de patrimonio o tipo de entidad. Agrega el AUM total, número de fondos, inversionistas y flujo neto de caja.
* **Parámetros:** `agrupar_por` (`entidad`, `subtipo_patrimonio`, `tipo_entidad`), `subtipo_patrimonio`, `fecha_corte`, `limite`.

### 7. `flujos_netos_captacion`
* **Descripción:** Analiza la dinámica comercial e institucional de captación en una ventana de fechas calculando Aportes Recibidos, Retiros/Redenciones, Anulaciones y el Flujo Neto de Caja ($Aportes - Retiros - Anulaciones$), agrupado por entidad administradora o fondo específico.
* **Parámetros:** `fecha_inicio` (YYYY-MM-DD, requerido), `fecha_fin` (YYYY-MM-DD, opcional), `nivel_agrupacion` (`entidad` o `fondo`), `codigo_entidad`, `orden` (`MAYOR_CAPTACION` o `MAYOR_SALIDA`), `limite`.

### 8. `radar_corridas_y_alertas_liquidez`
* **Descripción:** Escanea una fecha de corte para detectar alertas de liquidez y retiros masivos donde los retiros/redenciones del día superan un porcentaje crítico del patrimonio de precierre (`precierre_fondo_dia_t`). Clasifica la severidad en `CRITICA_CORRIDA`, `ALTA` o `MODERADA`.
* **Parámetros:** `fecha_corte` (YYYY-MM-DD), `umbral_retiro_pct` (por defecto 5%), `aum_minimo_cop` (por defecto $5.000 MM COP), `limite`.

### 9. `serie_historica_nav_y_tasas`
* **Descripción:** Extrae la serie temporal limpia de un fondo y tipo de participación entre dos fechas: evolución del valor de unidad de operaciones (NAV), AUM al cierre, número de inversionistas, flujos netos y rentabilidades reportadas con muestreo configurable (diario, semanal, mensual).
* **Parámetros:** `codigo_negocio` (requerido), `fecha_inicio` (YYYY-MM-DD, requerido), `fecha_fin` (YYYY-MM-DD), `tipo_participacion`, `codigo_entidad`, `frecuencia_muestreo` (`diaria`, `semanal`, `mensual`), `limite`.

### 10. `metricas_riesgo_cuantitativo`
* **Descripción:** Calcula métricas cuantitativas institucionales directamente sobre la serie histórica del NAV de un FIC en un rango de fechas: Retorno Acumulado, Rentabilidad Efectiva Anual exacta (CAGR), Volatilidad Anualizada, Maximum Drawdown (Max DD con fechas de pico y valle), Ratio de Sharpe, Ratio de Sortino (contra tasa libre de riesgo de referencia configurable) y evolución de flujos y participaciones.
* **Parámetros:** `codigo_negocio` (requerido), `fecha_inicio` (YYYY-MM-DD, requerido), `fecha_fin`, `tipo_participacion`, `codigo_entidad`, `tasa_libre_riesgo_ea_pct` (por defecto 9.5%).

### 11. `comparar_peer_group_fics`
* **Descripción:** Compara frente a frente un grupo de fondos (Peer Group de 2 a 8 códigos de negocio) en una fecha de corte: contrasta AUM total, número de inversionistas, ticket promedio por inversionista ($AUM / Inversionistas$), rentabilidades E.A. (diaria, 30d, 180d, 365d) y flujo neto reciente.
* **Parámetros:** `codigos_negocio` (array de strings, requerido), `fecha_corte` (YYYY-MM-DD, opcional).

### 12. `ejecutar_soql_avanzado`
* **Descripción:** Ejecuta una consulta SoQL (Socrata Query Language) directa y personalizada sobre el endpoint de Socrata. Permite realizar agregaciones ad-hoc, filtros complejos y cruces estadísticos utilizando las 26 columnas oficiales de la SFC.
* **Parámetros:** `select`, `where`, `group`, `having`, `order`, `q`, `limit`, `offset`.

---

## 🔌 Conexión al Servidor MCP

* **Endpoint HTTPS en Producción:** `https://mcp-sfc-fics-colombia.vercel.app/api/mcp`
* **Configuración en Clientes MCP (Claude Desktop / Cursor / Agentes):**
```json
{
  "mcpServers": {
    "sfc-fics-colombia": {
      "url": "https://mcp-sfc-fics-colombia.vercel.app/api/mcp"
    }
  }
}
```
