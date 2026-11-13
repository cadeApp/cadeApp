# Lecciones — PR #740 / T-436, ronda 1

1. **P08 / pr-738/PR738-H01:** un unit que mira si existe `script-src` o `connect-src` no protege los doce bloques de la política. La matriz de orígenes debe tener un oráculo independiente y mutaciones por familia (H02).
2. **P08 / pr-738/PR738-H04:** `page.addInitScript` ejecuta el listener antes de navegar, pero no hace duradero un array declarado dentro del `window`; los documentos intermedios pueden perder sus violaciones. Necesita prueba de evento → navegación → persistencia (H03).
3. **P08 / pr-738/PR738-H03:** un RED en el primer `expect.poll` no prueba resultados positivos evaluados antes si nunca se escribieron ni se afirmaron. La evidencia debe distinguir control de payload válido de falla de enforce (H04).
4. **pr-68/AG-75 / pr-63/AG-68 / pr-82/AG-76:** la batería del revisor es independiente. Seis mutaciones RED de un oráculo estático propio no se deben presentar como seis tests de producción RED.
5. **H01 / informe corregido:** `pnpm test` puede incluir más que Vitest. La bitácora decía verde mirando solo 3963 Vitest; la CI detectó el contrato roto del catálogo, y `3350cdb4` fue comprobado por el revisor en CI 86/86.

No se acuña AG nuevo hasta poder enumerar el máximo en **todas** las ramas remotas; esta sesión no tiene un clon Git para esa enumeración y los números históricos tienen colisiones. Conservar referencias con carpeta. No modificar `AGENTS.md` por un solo caso.

## Ronda 2 — Qué se aprendió al verificar los arreglos

- **H02 / P08:** una matriz literal independiente de directivas permite detectar tanto faltantes como **ampliaciones peligrosas** de la CSP (ej. `unsafe-eval`, `form-action *`, `object-src data:`). Ocho mutaciones nuevas del revisor fallaron en el comparador extraído; **no equivale** a ejecutar ocho Vitest mutados.
- **H03 / P08:** validar eventos **antes y después de navegar** obliga a conservar evidencia entre documentos y a reducir orígenes. El revisor ejecutó el callback real en un entorno JS con `sessionStorage` simulado: control GREEN y cinco mutaciones propias RED. Todavía falta el navegador de producción para asegurar integración con Next y CSP.
- **H04 / P08:** `[T-436 bypass]` anterior al primer `expect.poll` convierte un RED por falta de enforce en evidencia auditable de la **condición positiva previa**. Es correcto distinguir el RED/GREEN local en `next dev` del E2E confiable sobre build de CI. No vender stdout de bitácora como prueba independiente del revisor.
- **Flujo y CI:** los tests unit son el primer gate, pero en esta PR el factor decisivo es el `e2e-preview` de navegador real, con recursos y usuarios del entorno Develop; el workflow de mutaciones está diseñado para ejecutarse *después* del merge. No exigir otro CI verde **solo** por documentación de revisión.
- No se propone nueva regla AG ni una decisión adicional: las referencias P08 y las lecciones de `pr-738` ya cubren estas clases.
