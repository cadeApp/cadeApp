# Lecciones — PR #358 / T-356

**Fuente:** 2 bloqueantes de arquitectura detectados **antes de implementación** (solo lectura estática del contrato anterior). No se reportan regresiones reales ni pruebas RED→GREEN funcionales; no se añaden lecciones AG numeradas sin contraste con las ramas remotas.

## Patrón observado
Una Server Action puede bloquear una operación en la UI, pero **no** protege una tabla cuya RLS permite la misma operación por API directa. En datos versionados, permitir inserts sin una identidad SQL de «vigente» hace que las consultas de distintas superficies puedan interpretar versiones distintas.

## Acciones para el CC #363
1. Modelar vigencia única y bypass por INSERT/UPDATE en el contrato y sus pruebas DB, sin romper el alta inicial.
2. Crear motivo de rechazo público controlado separado de auditoría privada.
3. Diseñar ciclo Storage -> DB -> retención/purga con idempotencia y errores de red, además de consulta admin/courier coherente.
4. En la próxima ronda, exigir mutaciones independientes del revisor, no reutilizar exclusivamente las del autor.

**Advertencia:** esta PR es inusual porque el diff es únicamente la bitácora; los hallazgos califican una propuesta y su dependencia de CC, no código defectuoso introducido.
## Ronda 2 — Lecciones sin numeración AG
- Idempotencia en DB exige que UI reutilice UUID/path frente a respuesta perdida, no UUID nuevo por clic.
- Archivo subido sin fila DB no entra en cron sweep; rol courier sin DELETE no puede compensar mediante simple remove.
- Un estado local de tarjeta no actualiza badges de padre; verificar interfaz agregada.
- E2E con sembrado service-role de rejected no prueba rechazo administrativo ni re-revisión real.
Sin numerar AG hasta contrastar máximo en ramas; pruebas independientes no ejecutadas.

## Ronda 3 — observaciones (sin AG global no verificado)

- **Contratos tipados en todos los caminos:** un fallback manual de idempotencyKey puede violar un UUID aunque el camino moderno sea correcto. Validar antes de subir a Storage.
- **Separar reintento de reconciliación:** conservar misma key/path resuelve pérdida de respuesta RPC; no elimina el problema general de objeto sin referencia ni carrera entre Storage y DB. Issue #399 lleva el gate pre-staging/main por decisión del usuario.
- **Estado agregado y cabeceras:** conservar componentes de éxito tras la transición requiere un título compatible con ausencia de pendientes, no usar el nombre fijo de rechazados.
- **E2E verde sobre rama divergida:** verificar HEAD exacto, pero una PR dirty necesita merge con develop y revalidación del árbol combinado.
- No atribuirse los RED→GREEN del autor; sin pruebas propias, los fixes son arreglado-sin-verificar.
