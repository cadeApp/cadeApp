# Lecciones — PR #357 / T-361 · ronda 1

- **P08, coverage de invariantes:** comprobar solo el número de WhatsApp correcto en multi-drop no comprueba el contenido según estado individual. Caso: fixture ya tenía `delivered`, `pending` y `failed` pero el test no inspeccionaba el mensaje para esos tres.
- **P05, actor explícito:** no reutilizar texto de primera persona desde dos emisores distintos. Separar reglas de negocio y redacción con `sender` explícito y tests de matriz de actores.
- **P15, entrega E2E:** tener Preview READY y CI unitario verde no acredita E2E; el run debe identificar SHA, caso y resultado. Además los tests E2E antiguos pueden afirmar lo contrario del requisito corregido.
- **Prueba RED/verde:** registrar demostraciones reproducibles concretas en bitácora, no solo afirmar «RED demostrado». El revisor no atribuye un runtime a una inspección estática.
- **No se asigna un AG global nuevo en esta ronda:** falta confirmar patrón general mediante ejecución sobre el SHA y comparación con ramas remotas; evitar colisiones de identificadores. Revaluar en ronda 2.
