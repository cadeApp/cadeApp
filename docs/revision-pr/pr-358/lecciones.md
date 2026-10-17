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

## Ronda 4 — Lecciones sin AG global inventado

- **P11 + P08:** Storage acepta MIME y SQL valida extensión del path: la capa que compone el nombre debe normalizar desde los bytes/MIME efectivamente subidos; los tests no pueden cubrir sólo nombres `.jpg` felices.
- **E2E vs clase no enumerada:** 83 E2E correctos sobre JPEG `.png`/`.jpg` no descartan variante `.jfif` normal de `image/jpeg`; recorrer clases MIME + sufijo, no un ejemplo único.
- **Probidad:** un probe de paridad Node sin clon prueba la incompatibilidad de strings pero NO sustituye ejecutar el módulo TS ni una mutación real con tests del repositorio.
- Al hacer merge de develop, medir HEAD + base y esperar E2E del nuevo HEAD, sin copiar el verde del previo.

## Ronda 5 — cierre técnico, evidencia delimitada

- **P06/P08:** test de ruta persistida debe seguir el MIME realmente producido por el compresor, no la extensión de nombre; cambiar .png→.jpg en la aserción E2E es una actualización fundada, no necesariamente adulteración. Se contrastó compresor, helper y SQL.
- **Verificación independiente acotada:** ejecutar el cuerpo original extraído en V8 permite una mutación auténtica sobre la función pure JS/TS sin clone ni secretos: GREEN 10, RED 7, GREEN 10. No equivale a correr el módulo importado con Vitest, Storage ni E2E. Describir exactamente ese límite.
- **Gate de release:** CI unit/pgTAP verde y approval-policy verde no sustituyen Playwright pendiente. Ronda terminada sin nuevos defectos detectados, con bloqueo de validación E2E explícito.

## Ronda 6 — Cierre de gate sin nueva numeración AG

- **Comprobar el checkout, no confiar en `workflow_run.head_sha`:** los E2E de workflow confiable declaran HEAD de `develop`, pero hacen checkout explícito de SHA de PR; verificar job checkout y target del status publicado.
- **No confundir cancelación con fallo funcional:** run anterior quedó cancelled; el run sucesor pasó 86+3 casos sobre descendiente exclusivamente documental. Sólo el sucesor justifica gate verde.
- **Separar decisión de merge y rollout:** T-356 puede quedar lista para develop con T-370 #399 abierta como gate anterior a staging/main, según decisión previa del usuario.
- **No sumar ronda de CI por documentación:** la validación fue completada para el SHA exacto anterior al commit documental de cierre; el código no cambió.
