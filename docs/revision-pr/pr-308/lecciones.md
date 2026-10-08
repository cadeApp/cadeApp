# Lecciones — PR308 / T-350 — Ronda 1

**Pérdida de historial de sesiones (PR308-H01):** un archivo puede seguir siendo Markdown válido y la suite pasar íntegra mientras se borra la entrada de alta y las decisiones de diseño de la ficha. Al cerrar sesión se debe comparar la bitácora contra develop y agregar las nuevas entradas sin modificar las originales. No sustituirla con un resumen de lo antiguo.

**E2E por test vs por job:** la PR temporal #307 demuestra GREEN de R07, C06 y `DoD: axe AA en viaje` en dos corridas, y RED de las precondiciones. Pero el workflow de Playwright da failure por ocho tests fuera de T-350. Documentar los tres PASS exactos sin presentar el job como GREEN completo.

**Infraestructura vs código:** Vercel rate-limited en el HEAD de #308, aunque build/test locales de CI de GitHub están verdes. No maquillar el check ni emitir commits vacíos en masa para forzar nuevos despliegues. La configuración Production del Map ID requiere confirmación humana; Preview GREEN no basta para afirmar Production GREEN.
