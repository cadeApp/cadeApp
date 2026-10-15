# Lecciones — PR #357 / T-361 · ronda 1

- **P08, coverage de invariantes:** comprobar solo el número de WhatsApp correcto en multi-drop no comprueba el contenido según estado individual. Caso: fixture ya tenía `delivered`, `pending` y `failed` pero el test no inspeccionaba el mensaje para esos tres.
- **P05, actor explícito:** no reutilizar texto de primera persona desde dos emisores distintos. Separar reglas de negocio y redacción con `sender` explícito y tests de matriz de actores.
- **P15, entrega E2E:** tener Preview READY y CI unitario verde no acredita E2E; el run debe identificar SHA, caso y resultado. Además los tests E2E antiguos pueden afirmar lo contrario del requisito corregido.
- **Prueba RED/verde:** registrar demostraciones reproducibles concretas en bitácora, no solo afirmar «RED demostrado». El revisor no atribuye un runtime a una inspección estática.
- **No se asigna un AG global nuevo en esta ronda:** falta confirmar patrón general mediante ejecución sobre el SHA y comparación con ramas remotas; evitar colisiones de identificadores. Revaluar en ronda 2.

## Ronda 2 — PR357-R01 (2026-10-15)

- **No degradar tests existentes para resolver una regresión UI:** `getByText` de T-340 dejó de ser unívoco tras añadir un CTA con nombre visible. La solución preserva el nombre accesible (`aria-label`) sin duplicar el texto que E2E anterior busca. Una prueba nueva de T-361 debe garantizar simultáneamente texto visible genérico y nombre accesible, no solo `href` correcto.
- **P07/Playwright:** los selectores por contenido pueden abarcar varias zonas semánticas cuando se añaden acciones. Enumerar todas las apariciones en las vistas afectadas, no remendar únicamente la primera falla.
- **Trazabilidad de `repository_dispatch`:** `workflow_run.head_sha` puede ser el commit de la rama que alberga el workflow (`develop`); comprobar `actions/checkout.ref` y `git log -1` del job antes de atribuir resultado a SHA auditado.
- No se asigna nueva numeración AG global sin inspeccionar máximo de todas las ramas y verificar el patrón reincidente.
