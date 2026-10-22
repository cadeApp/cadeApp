# Ronda 1 — T-370 / CC-030 — 2026-10-17

**HEAD inspeccionado:** `ef990947474cd404c0adda429f852589c5c55732` · **Base:** `711a2f7054d77fd664d3ec09b3bbdd24efb88476`.

```
Informe revisar-pr — T-370 — 2026-10-17 — revisión independiente
Resultado: CON BLOQUEANTES (2)
Checks: typecheck ✅ (CI) · lint ✅ (CI) · test ✅ (CI, 2595/2595) · test:db ✅ (CI, 2466/2466)
E2E Preview: bloqueado; no se ejecutó contra una base Develop con CC-030 migrado.
BLOQUEANTES:
- [src/server/cron/orphan-courier-documents.ts:31] RPC admite todos los nombres de courier-docs, validador exige courier/ → un huérfano fuera de ese prefijo aborta la purga.
- [src/server/cron/orphan-courier-documents.ts:72,93,107] Mensajes de error externos no sanitizados pueden transportar rutas privadas a la alerta crítica de /api/cron/sweep.
MEJORAS / PROCESO:
- [docs/revision-pr/pr-401/README.md original] Autorrevisión de autor en carpeta reservada; archivada íntegra como autorrevision-agy-r0.md.
Decisiones Lautaro073: 1A (7 días), 2A (dry-run), 3A (bloque CI).
```

## Lecturas y alcance

Se leyeron `docs/revision-pr/COMO-ENTREGAR.md`, `docs/revision-pr/README.md`, `.agents/skills/revisar-pr/SKILL.md`, `AGENTS.md`, PR #401, comentarios, issue #399, CC-030 #400 y bitácora T-370. `docs/tasks/T-370.md` **no existe en develop** (comprobación directa); Lautaro073 ya autorizó crearla en esta PR. Se contrastó con DoD del issue #399 y la ficha añadida en la rama. La comparación `develop...HEAD` da **19 archivos, 7 commits, 0 detrás de develop**, todos cubiertos por «Archivos permitidos» de la ficha propuesta. Contratos RPC/DB respaldados por CC-030. Sin paquetes nuevos, sin cambios de UI y sin ampliación no autorizada detectada en el bloque de CI.

El trigger `courier_documents_orphan_claim_guard` serializa reclamos con `INSERT`/`UPDATE OF storage_path` de `courier_documents` mediante advisory lock. Las RPC validan `service_role`, tienen `search_path` explícito y los objetos históricos con fila quedan excluidos. Estas propiedades son coherentes **por inspección**; la verificación concurrente independiente todavía no se ha repetido.

### PR401-H01 — BLOQUEANTE / correctness / P08 — severidad medio

**Ámbito entero enumerado:** la consulta SQL en `supabase/migrations/20261017150000_cc030_courier_docs_orphan_reconciliation.sql:114-126` filtra exclusivamente `bucket_id`, fecha y ausencia de fila; **no filtra nombre ni prefijo**. Su respuesta añade cualquier `o.name` elegible a `claimed` (:164-165). En cambio `src/server/cron/orphan-courier-documents.ts:24-36` exige `storagePath: z.string().startsWith('courier/')`. Un objeto antiguo `legacy/orphan.jpg` en ese bucket, sin fila, queda reclamado y el cron falla en :74-76 antes de llamar a `remove()`. Ninguna prueba existente inserta un huérfano de otro prefijo dentro **del mismo** bucket (el test de «otro bucket» es otro caso).

**Demostración lógica del defecto:** con `storage.objects(bucket_id='courier-docs', name='legacy/orphan.jpg', updated_at=now()-10d)` y sin fila en `courier_documents`, la RPC lo incluye, pero `startsWith('courier/')` devuelve falso. La existencia real de esos objetos en Develop es desconocida; la incompatibilidad de contrato es demostrable por inspección. No atribuir incidentes reales.

**Corrección precisa:** la autoridad sobre bucket y elegibilidad permanece en SQL; aceptar en Zod `z.string().min(1)` para rutas devueltas por la RPC y mantener `max(100)`, los tipos, `dryRun` y `remove` exclusivamente sobre las rutas reclamadas. Mantener la restricción `courier/` únicamente en los writers de UI (que crean rutas nuevas), no en la purga general. Convertir la prueba preexistente «ruta fuera del prefijo courier/» en caso positivo sin eliminar aserciones útiles y añadir un caso pgTAP con un huérfano antiguo no canónico **en courier-docs**. Mutación independiente propuesta: restaurar temporalmente `.startsWith('courier/')`; la nueva prueba debe quedar RED y tras restaurar debe quedar GREEN.

**Por qué el CI actual no lo atrapa:** fixture y test de cron sólo usan nombres `courier/...`; no prueba el universo de nombres que la RPC admite.

### PR401-H02 — BLOQUEANTE / privacidad / P08 — severidad alto

**Ámbito entero enumerado:** las tres fronteras de error externas de `reconcileOrphanCourierDocuments`: RPC claim en `src/server/cron/orphan-courier-documents.ts:72`, Storage remove en :93 y RPC complete en :107, interpolan `.message` sin redactar. El `catch` de `src/app/api/cron/sweep/route.ts:32-44` envía `error.message` y `error.stack` a `sendCriticalAlert`; el canal operativo de alertas puede recibir esa cadena. El body HTTP sí se reduce a `Internal Error`, pero **la alerta no**. Una respuesta externa sintética `{message:'failed courier/<uuid>/dni_front_123.jpg'}` terminaría en dicha alerta. La ejecución con un error real que contenga ruta no ha sido observada: se trata de un vector condicional comprobado en el flujo de código.

**Corrección precisa:** en las tres ramas de error del módulo nuevo arrojar textos **constantes**, sin `error.message`, `error.details`, `error.hint` ni `cause` que contenga respuestas crudas. Ejemplos: `Failed to claim orphan courier documents`, `Failed to remove orphan courier documents`, `Failed to complete orphan courier document purge`. Mantener `throw` para conservar 500 y alerta, con etapa segura reconocible y sin rutas/UUID en el texto. Agregar tests de `claim`, `remove` y `complete` con mensajes simulados que contengan una ruta privada, verificando que la excepción propagada NO la incluya. Mutación independiente: reintroducir interpolación en `removeError.message` y comprobar RED en el test de privacidad, restaurar y GREEN.

**Por qué el CI actual no lo atrapa:** `las métricas no incluyen rutas ni identificadores` inspecciona sólo `console.info` en el camino exitoso; el test de error afirma que se preserva el texto externo `storage unavailable`. Ninguno mira la excepción/alerta con contenido sensible.

### PR401-H03 — proceso (no bloqueante, corregido documentalmente)

La autorrevisión generada por el mismo agente era el README dentro de `docs/revision-pr/pr-401/`. La regla de independencia reserva esta carpeta al revisor (precedente AG-36). Se preservó el texto original sin modificar en `autorrevision-agy-r0.md` y se sustituyó README por la portada independiente. No se han marcado como `arreglado-verificado` afirmaciones del autor. No borrar ese archivo en rondas siguientes.

## Evidencia de CI por SHA

`CI run 39050363050` asociado al HEAD `ef990947474cd404c0adda429f852589c5c55732`: unit 140/140 archivos y 2595 tests, typecheck, lint, build, audit y bundle-budget pasan. `db-tests` job 117447530842: `cc030_courier_docs_orphans.sql` 46/46 GREEN; mutación de gracia 0 provoca 7/46 RED y restauración 46/46 GREEN; concurrencia trigger deshabilitado RED y restaurado GREEN, integraciones CC-025/CC-030; última suite pgTAP `Files=28, Tests=2466, Result: PASS`; `db:types` generados sin diff. Se contrastaron líneas efectivas de los logs, pero esos son controles del autor/CI, **no reemplazan nuestras mutaciones nuevas**.

`e2e-preview` no tiene suite ejecutada en el HEAD (estado de verificación no satisfactorio, con dependencia de migración CC-030 en Develop declarada por el autor). No interpretar como un E2E verde ni activar `enforce` por ese motivo. No se inició Docker/Supabase local ni se contactó ninguna base remota.

## Decisiones cerradas por Lautaro073 antes de publicar

- **1A:** gracia de **7 días** desde última escritura, distinta de retención histórica D8 de 30 días.
- **2A:** configuración predeterminada **`dry-run`**, nunca `enforce` automática.
- **3A:** aprobado el bloque CC-030 de `.github/workflows/ci.yml`; no se requiere otro cambio de workflow por esta decisión.

## Gate de ronda siguiente

Exigir tests de los dos escenarios nuevos con mutaciones independientes RED→GREEN, no sólo los 2595 tests anteriores; revalidar en HEAD corregido, revisar diff de la respuesta y comprobar que `docs/revision-pr/**` no haya sido tocado por el agente. Controlar cobertura de nuevas rutas sin conceder DELETE a clientes. Cerrar una segunda ronda separada antes de recomendar merge; si la única actualización posterior es documental, no exigir un nuevo CI green sólo por la bitácora.
