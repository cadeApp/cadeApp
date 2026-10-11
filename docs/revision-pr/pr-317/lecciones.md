# Lecciones — PR #317

Hallazgos: 5 bloqueantes (H01–H05). No se asignan AG nuevos sin revisar el máximo de todas las ramas remotas, para evitar colisiones de numeración.

## Dos patrones probados

1. **P04-test-tautologico:** un archivo etiquetado “38 aserciones” tenía 22 llamadas directas a `pass()`; jamás comprueban comportamiento ni distinguen implementación correcta de rota. Un `plan(n)` no equivale a cobertura.
2. **P15-entregable-declarado-pero-no-ejecutable:** la prueba usa columnas que no existen y crea solicitudes sin claves obligatorias. Como la migración abortó primero, el falso verde potencial quedó oculto.

## Reglas operativas propuestas

- **Aserciones reales:** rechazar `pass()` y `ok(true)` sin justificación semántica; cada caso debe fallar con una mutación independiente y recuperarse al restituir la regla.
- **Compatibilidad DDL:** antes de implementar backfill, leer columnas reales de `develop` y probar migración CI; jamás completar datos personales o consentimiento con placeholders por conveniencia.
- **Rollout por checkpoints:** gate automatizado o revisión explícita del conjunto de lectores, puente y escritor por PR; que la compilación no permita saltarse el paso del contrato.

No se tocaron `AGENTS.md` ni reglas de CI. Estas lecciones deberán contrastarse con otras PR antes de convertirlas en normas transversales.

## Ronda 2 — Hallazgos H06 a H09

- **H06 (crítico), P05/P08:** un `db-tests` verde no garantiza serialización cuando el trigger pasó a `SECURITY DEFINER` y condiciona su ejecución a `current_user`. El propio contrato de CC-022 §2b lo prohibía. Refuerza `pr-64/AG-62`: donde no pueda ejercerse una carrera real, un control estructural específico debe detectar esta configuración peligrosa y probar su propia mutación.
- **H07, P04:** reemplazar `select pass()` por pruebas que insertan ellas mismas la fila esperada sigue siendo una prueba independiente del comportamiento productivo. Refuerza `pr-63/AG-68`.
- **H08, P08:** secuencial no significa concurrente. La prueba de RLS no puede certificar que un lock previene un TOCTOU. Refuerza `pr-68/AG-74` y la exigencia de dos sesiones.
- **H09, P06:** auditar un backfill requiere enumerar las mismas exclusiones que aplica el materializador, incluidas las relaciones entre medio de pago y monto de cambio.

No se modifica `AGENTS.md` ni se asigna numeración AG nueva: las reglas existentes ya contemplan estos patrones y aún falta ejecución de pruebas concurrentes en CI.

## Ronda 3 — Un error de nuestra propia recomendación, y privacidad en auditoría

**R3/H10 (revisión equivocada):** en la ronda 2 el revisor exigió que un histórico `transfer+needs_change=true` o `cash+needs_change=true+NULL` se omitiera y auditara. Tras releer el contrato **CC-022 §5b**, esa indicación resultó incorrecta: el backfill debe **normalizar y materializar** ambos, y reportar anomalías sin inventar montos. La existencia de auditoría no sustituye la obligación contractual de conservar la entrega. **Lección:** al pedir un cambio de semántica, citar literalmente la cláusula fuente y comprobar con tablas de decisión de casos válidos, históricos normalizables e inválidos de nueva publicación. No trasladar al backfill la validación de `publish_request`.

**R3/H11 (datos sensibles):** audit_log es un log, aunque tenga RLS admin. No copiar `cash_change_amount`, notas ni contactos a `before/after`; usar flags como `has_cash_change_amount` para observabilidad sin duplicar secretos. Refuerza `AGENTS.md §2` y P08.

**R3/H12 (historia falsificada):** `updated_at` y `created_at` no significan `delivered_at`; un `coalesce` que evita el error SQL puede convertir ausencia de evidencia en un hecho falso. Probar la fila histórica incompleta antes de añadir fallbacks.

**R3/H08 (pendiente):** la suite impide `SECURITY DEFINER` y la eliminación textual del lock, pero no ha ejercitado dos transacciones concurrentes. Un control estructural es útil y necesario, pero no sustituye una prueba runtime de carreras requerida por contrato.

No se propone numeración AG nueva: la lección más importante es **revalidar contra la fuente**, incluidas las sugerencias del propio revisor.

## Ronda 4 — Estado anterior mejoró, pero falta probar los RPC abiertos

**H10–H12 cerrados:** el autor implementó correctamente la semántica de normalización del CC-022 y dejó de duplicar el monto sensible y de inventar fechas. Los nuevos casos sí llaman al helper de backfill real; CI valida 52 aserciones de T-340. La revisión anterior aportó una rectificación necesaria (R2/H09): **la fuente contractual prevalece sobre el comentario del revisor**.

**H08 sigue abierto:** validar `SECURITY INVOKER` + `FOR UPDATE` en `pg_proc` no sustituye un ensayo de concurrencia con dos sesiones y estado final. Es un caso de `pr-64/AG-62`; un harness autónomo de DB en CI merece autorización de alcance y debe vivir junto a la suite SQL, no trasladarse al E2E del formulario de la etapa 4.

**H13 nuevo:** probar `has_function` de una RPC no detecta que su lógica de autorización, idempotencia o cierre esté vacía o cambiada. Cuando una migración habilita `GRANT EXECUTE` a clientes, ese mismo PR debe probar las transiciones de negocio que habilita antes de su despliegue. Refuerza P08, `pr-63/AG-68` y el requisito de enumerar la clase entera (pr-56/AG-37).

**Proceso:** el autor marcó en el cuerpo de la PR «tests ... concurrentes» como hecho mientras su bitácora reconoce que H08 está pendiente. Antes de mergear, el cuerpo debe alinearse con la evidencia CI, sin falsear DoD. `approval-policy` no verifica exhaustivamente cobertura semántica.

## Ronda 5 — Ocho «OK» no equivalen a ocho carreras contra la RPC

- **H08, P08:** un runner puede abrir dos sesiones reales, consultar `pg_locks` y confirmar estados finales, pero seguir probando el sustituto equivocado: cuatro casos `publish-first` hacían `UPDATE status='published'` manual, mientras el contrato exige competir contra `publish_request`. La cobertura debe rastrear **la operación productiva exacta**, no un efecto observable parecido. Además, `pg_locks.granted=false` global no identifica al actor esperado; correlacionar `pg_blocking_pids` con los PIDs de ambas sesiones. `psql` debe terminar al primer error inesperado antes de imprimir marcadores de éxito.
- **H13, P08/AG-37:** nuevos pgTAP funcionales pueden tener oráculos indirectos. La solicitud del test `mark_delivered` legacy ya estaba `delivered`; borrar la prohibición N>1 no lo pondría en rojo porque falla antes por estado global. El test `not in_transit` carecía de oferta aceptada y admitía `UNAUTHORIZED_ACTOR`. **Para probar un guard, preparar todas las demás precondiciones válidas y mutar exactamente ese guard**: si el test no se pone rojo, no está protegido.
- **Calidad de evidencia:** el autor informó CI real (1.972 pgTAP + runner 8/8), lo cual es correcto como resumen de ejecución, pero no demuestra que ocho escenarios hayan enfrentado a la RPC ni contiene salida de mutaciones productivas negativas. Verificación independiente de `evidencia/comandos.md` — sondas de lectura y control en memoria; no exagerar como RED SQL real.

No crear identificadores AG nuevos para estos patrones; reutilizar pr-56/AG-37, pr-63/AG-68 y pr-68/AG-74/75, indicando el precedente exacto.
