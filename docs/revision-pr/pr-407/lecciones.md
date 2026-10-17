# Lecciones — PR #407, T-371

## pr-407/L01 — El resultado de un mock no prueba la invocación

**Patrón recurrente P08.** Los tests de error de ActionResult que solo comparan el error recibido no ejercen el contrato de llamado: una rama local podría devolver el mismo código. Para un test cuyo título dice «propaga desde RPC» o «muestra error de la acción», registrar expect explícito del spy de la RPC o Server Action y probar un mutante que se salte esa dependencia. No convertir el test en un mero snapshot del copy. Los otros tests existentes pueden corroborar el flujo general pero no reemplazan la prueba específica de propagación T-371.

## pr-407/L02 — La omisión documental fue introducida en la ficha original

La creación de T-371 en PR #406 omitió la fila de docs/implementation-plan.md y encabezados exactos. La revisión asume su error, lo reparó en la PR documental #408 y la mergeó a develop; no imputarlo como una decisión de producto inconsulta del agy. Ahora solo debe sincronizarse #407. No pedir nuevo CI por la normalización documental.

## pr-407/L03 — Comparar ERROR vigente con contrato, no preservar una aserción caducada

Tras CC-029, el comercio con legacy vencido puede acceder usando créditos o plan válido. Para un comercio sin esos derechos el rechazo PUBLICATION_CREDITS_EXHAUSTED es correcto. El E2E anterior exigía SUBSCRIPTION_INACTIVE por historia previa. Actualizar esa expectativa fue correcto cuando se demostró el cambio del contrato; exigir restauración exacta de fixtures y prueba real de no publicación evita false positives.

No agregar número AG global sin verificar el máximo entre ramas remotas (requisito del proyecto); las lecciones locales se identifican por carpeta y Lnn.