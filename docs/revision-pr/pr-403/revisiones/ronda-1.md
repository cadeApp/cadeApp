# Informe independiente — PR #403 / T-367 — Ronda 1

**PR:** https://github.com/cadeApp/cadeApp/pull/403
**HEAD examinado:** `d1af180bbe7a0ac562dfe20fd5ed919aca3aa3c3`
**Base documental:** `develop`, ficha T-367 leída allí; PR parte de `708a9afb` y `develop` avanzó al menos 13 commits.
**Fecha:** 2026-10-17
**Resultado:** CON BLOQUEANTES (4 técnicos/de evidencia). Un incidente de proceso se conserva separado; una mejora es no bloqueante.
**Método:** lectura independiente de diff, implementación, migraciones CC-025, RLS, fixtures E2E, bitácora, historial de commits y estado de GitHub Actions. No hubo clon local ni mutaciones ejecutadas: sin red, no se declara resultado RED.

## Resumen

| ID | Clasificación | Archivo:línea | Situación |
|---|---|---|---|
| PR403-H01 | BLOQUEANTE · alto | `src/features/courier-onboarding/queries.ts:157-161` | Un avatar puede firmar un path de selfie/DNI con igual carpeta |
| PR403-H02 | BLOQUEANTE · alto | `e2e/specs/courier-onboarding.spec.ts:1542-1546` | La E2E no demuestra descarga real ni aislamiento entre usuarios; E2E Preview cancelado |
| PR403-H03 | BLOQUEANTE · medio | `src/features/courier-onboarding/queries.test.ts:311,334` | `any` nuevo en los mocks, contrario a skill |
| PR403-H04 | PROCESO · medio, separado por revisor | `docs/revision-pr/pr-403/revisiones/ronda-1.md:8` | Autorrevisión firmada por el autor como independiente |
| PR403-H05 | BLOQUEANTE · medio | `docs/tasks/T-367.md:62-66` | DoD y RED declarados completos sin evidencia E2E ni mutaciones reproducibles |
| PR403-H06 | MEJORA · bajo | `src/features/courier-onboarding/queries.ts:127-153` | Predicado de vigencia debe quedar en la consulta, no después del `limit(1)` |

## PR403-H01 — Ruta bajo carpeta propia no prueba que el archivo sea un avatar

**Diagnóstico [ANÁLISIS]:** El resultado `courier_documents` se filtra por `kind='avatar'`, pero la verificación del path solo exige `courier/<courierId>/` y ausencia de `..`. El SQL `submit_courier_onboarding_documents` en `20261016033941_cc025_onboarding_atomic.sql` permite asignar a una fila `kind='avatar'` un path `courier/<id>/selfie_123.jpg`: comprueba la carpeta, no el prefijo según tipo. En ese estado, la función firma la selfie con service role. Esto contradice el DoD que prohíbe usar selfies, DNI, licencia o seguro como avatar. No se afirma que ya exista una fila así en staging.

**Arreglo:** validar el nombre canónico completo, no solamente el directorio: `courier/<id>/avatar_<timestamp>.<png|jpg|jpeg|webp>` con timestamp decimal. El uploader vigente `buildCourierStoragePath` sigue ese esquema. Exigir `is_current=true` en la consulta. No tocar migraciones: se trata de la guarda defensiva al firmar; si aparecen datos históricos no canónicos, reportarlos y definir migración por CC separado, nunca firmar rutas dudosas.

**RED exigida:** nuevo caso en `queries.test.ts` con fila `kind:'avatar',status:'verified',is_current:true,storage_path:'courier/courier-1/selfie_123.jpg'` y análogos para DNI/licencia/seguro. Debe esperar `null` y cero firmas; antes del arreglo falla, después pasa. Agregar positivo `avatar_123.png`. El mock debe verificar que la firma reciba exactamente ese path.

## PR403-H02 — E2E de Storage insuficiente y no validada

**Diagnóstico [VERIFICADO EN FUENTE/CI]:** en la nueva prueba `expect(avatarImg).toBeVisible()` y atributos `src`/`token=` no prueban que el objeto se descargue y decodifique; tampoco inicia sesión con el segundo cadete para intentar leer el recurso ajeno. El fixture `stagingContext` crea dos usuarios por prueba y los limpia, por lo que usarlo es válido: el problema es la cobertura, no la limpieza. El estado publicado `e2e-preview` para este HEAD es `error` y el run asociado 39062060834 terminó `cancelled`, NO verde. No afirmamos que la implementación haya fallado una E2E ejecutada.

**Arreglo:** en `e2e/specs/courier-onboarding.spec.ts` usar path canónico `avatar_<timestamp>.png`, esperar además `img.complete && img.naturalWidth > 0` y verificar que la respuesta del recurso sea satisfactoria. Usar el segundo courier sembrado para demostrar que su sesión no recibe la imagen del primero y que no puede crear una URL firmada para el objeto ajeno vía cliente autenticado. No probar 403 al abrir una URL ya firmada: es un bearer token temporal. Verificar también falta/rechazo, error de archivo y recarga. Ejecutar E2E Preview completa en el HEAD final; distinguir cancelación de fallo de aserción.

**RED exigida:** suprimir temporalmente el render del avatar y comprobar que falla la prueba de imagen decodificada; eliminar la comprobación de aislamiento o alterar la autorización y constatar un fallo específico de acceso cruzado. No usar mock de toda la página para demostrar comportamiento del navegador.

## PR403-H03 — `any` introducidos en el código de tests

**Diagnóstico [ANÁLISIS]:** líneas 311 y 334 de `queries.test.ts` agregan `docQuery: any` y `from: fromMock as any`. Es código nuevo y la skill declara explícitamente `any` como bloqueante. La consulta se simula con un builder que devuelve cualquier fila aun si se quitan predicados.

**Arreglo:** builder tipado explícitamente con `vi.fn`, interfaz de query de solo los métodos usados, o `unknown` con cast controlado en el borde; prohibido `any` y `@ts-ignore` nuevos. Comprobar argumentos de `eq('kind','avatar')`, `eq('status','verified')`, `eq('is_current',true)` y ruta de firma.

## PR403-H04 — Autorrevisión presentada como independiente

**Diagnóstico [VERIFICADO EN GIT]:** el commit `dc5e631c` de asako669 añadió `docs/revision-pr/pr-403/` y su `ronda-1.md` decía "Revisor asako669 (agy), SIN BLOQUEANTES". Contradice propiedad del directorio. **Remediación de este revisor:** el informe original se conserva en `revisiones/autorrevision-agy-r1.md`; la nueva `ronda-1.md` y demás archivos son revisión independiente. No permitir que el agy vuelva a editarlos.

## PR403-H05 — DoD marcado completo sin verificación que lo respalde

**Diagnóstico [ANÁLISIS + CI]:** `docs/tasks/T-367.md` marca `[x]` tanto "se prueba acceso real ... otro usuario" como "validación humana de staging tras promoción", aunque la prueba no hace ataque cruzado, la E2E de Preview quedó cancelada y la promoción humana es posterior al merge. La bitácora declara 2+9+5 casos RED pero `evidencia/comandos.md` original contiene únicamente comandos verdes y no hay artefacto reproducible de esos rojos. No se acusa falsificación: se declara ausencia de prueba verificable.

**Arreglo:** desmarcar los casilleros todavía no demostrados y documentar límites reales en bitácora (prohibido editar alcance/criterios). Aportar comando, fallo RED de la aserción exacta y posterior GREEN; solo marcar como hecha la E2E tras resultado verde en su SHA. La validación humana en staging queda pendiente hasta promoción, sin bloquear el merge por ocurrir después.

## PR403-H06 — Mejora: seleccionar explícitamente la versión vigente

**Diagnóstico [ANÁLISIS]:** `getCourierApprovedAvatarUrl` ordena los `verified` por `uploaded_at` y toma 1 antes de comprobar `is_current` en JS. Aunque RLS del propietario y la migración CC-025 restringen versiones vigentes, la consulta puede ser llamada como admin, a quien RLS permite ver históricos; la regla del dominio debe estar dentro del query.

**Arreglo recomendado:** añadir `.eq('is_current', true)` antes de `order`/`limit`; prueba de dos versiones (histórica y vigente) que compruebe el predicado real. Es mejora defensiva, no se afirma un fallo observado en el flujo normal de un courier.

## NO TOCAR / falsos positivos descartados

- `createAdminClient` no va al navegador: está dentro de `queries.ts` con `server-only`. Firmar una ruta después de verificar el actor y el estado es compatible con el bucket privado.
- `unoptimized` en `next/image` es coherente con URL firmada y evita alterar `next.config` fuera de alcance.
- El fixture de Playwright crea y elimina usuarios efímeros por prueba: no se acusa al nuevo test de borrar usuarios reales.
- `develop` avanzó respecto al punto de partida (13 commits en comparación), pero GitHub reportó `mergeable=true`. No se ejecutó `git merge-tree`, por lo que no se certifica ausencia de conflictos.

## Checks y limitaciones

- HEAD `d1af180b`: GitHub Actions CI `success`; jobs `unit, typecheck, lint, build, db-tests, audit, bundle-budget` verdes.
- Job DB `117481608182`: `Files=29, Tests=2735, Result: PASS` y comparación de tipos de base generados sin cambios.
- Vercel `success`; `approval-policy` `failure`; `e2e-preview` `error` con ejecución cancelada.
- No se ejecutó clon local ni mutaciones reales: el contenedor de esta revisión no tiene resolución DNS a GitHub y no dispone del repo. Evidencia de comandos a ejecutar y harness íntegro en `../evidencia/comandos.md`; jamás marcar `verificado_en_sha` por mera lectura.

## Condiciones para ronda 2

1. Pushear fixes estrictamente en archivos permitidos; no tocar `docs/revision-pr/**`.
2. Proporcionar RED→GREEN con salida del test específico y mocks no adulterados.
3. CI + E2E Preview verde del HEAD de implementación, con prueba de red real y dos usuarios.
4. Revisión independiente verifica la clase completa de rutas, autorización, versiones y fallback antes de liberar merge.

**Decisiones 🔵:** ninguna. Los requisitos salen de T-367 y del contrato de Storage vigente.
