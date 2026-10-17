# Ronda 1 — PR #360 / T-359

**Revisión independiente, 2026-10-15. HEAD `325a9a6a09de404efedd40ad1ee5728e5d9f218f`; base `14c28ed3c41cb2bde92705fc018c7dd0df73245b`. Resultado: CON BLOQUEANTES (3 altos, 4 medios).**

## Método, alcance y límites

- Lectura de `docs/revision-pr/COMO-ENTREGAR.md`, `docs/revision-pr/README.md`, `.agents/skills/revisar-pr/SKILL.md` y ficha T-359 en develop; PR, comentarios, bitácora, cambios y contexto de producción/fixtures desde GitHub.
- `git compare` adelantado 4 commits y 0 atrás sobre develop al inspeccionar; GitHub informó mergeable. No ejecuté `git merge-tree` en terminal. No existía aún carpeta pr-360; se inspeccionó WIP previa y nuevo commit con implementación.
- Los 8 archivos modificados son permitidos. No detecté cambios de contratos, RPC, RLS, migraciones ni dependencias.
- El shell del revisor no tiene clon, pnpm ni DNS a github.com; acceso mediante conector. **No ejecuté tests, mutaciones ni E2E**; hallazgos son ANÁLISIS. No consulté CI porque permanecen bloqueantes. No atribuyo una verificación independiente al informe de asako669.

## Matriz completa de estados

| Estado de request | Ruta/comportamiento correcto | Aceptar |
|---|---|---|
| draft | No-publicada; no selector aceptable | No |
| published, no vencida + oferta pending | Selector y modal | Sí |
| published, oferta accepted/rejected/withdrawn | Badge/no aceptable | No en esa oferta |
| published, expiresAt pasado | Información vencida y revalidación | No |
| matched, in_transit, delivered | Redirect server a `/trips/[id]` | No |
| cancelled, expired | **B elegida:** detalle terminal en la ruta merchant, sin selector ni privados | No |

El `request.status` se lee del servidor para decidir rutas; los errores concurrentes obligan a reconsultar. El backend `accept_offer` sigue siendo árbitro de exclusión mutua, sin tocarlo.

## Hallazgos

### PR360-H01 · ALTO · Los estados cancelled/expired no ofrecen vista terminal B

**Archivo:** `src/app/(merchant)/merchant/requests/[id]/page.tsx:29` · **Patrón:** `P06-enumeracion-incompleta` · **Estado:** abierto; prueba independiente NO EJECUTADA.

La página redirige matched/in_transit/delivered, pero deja cancelled/expired en RequestOffersList, que continúa dibujando lista de ofertas y vencimiento. Debe renderizar resumen terminal seguro en la MISMA ruta y acceso al historial, sin selector, contactos ni Aceptar.

**Verificación exigida:** caso unitario/flujo correspondiente GREEN normal, RED con mutación en código de producción real y GREEN tras restaurar bytes en memoria; E2E Preview cuando aplique. El prompt del comentario contiene archivos exactos y oráculos.

### PR360-H02 · ALTO · ALREADY_MATCHED deja abierta la aceptación obsoleta

**Archivo:** `src/features/requests/components/request-offers-list.tsx:164` · **Patrón:** `P08-control-no-cubre-lo-que-dice` · **Estado:** abierto; prueba independiente NO EJECUTADA.

En carrera contra otra sesión, handleConfirmAccept fija texto de error pero no reconsulta request.status y el componente sigue con el published del servidor inicial; permite repetir intentos. Reconciliar leyendo estado actualizado por refresh/revalidación; al existir viaje navegar al detalle, al estar terminal mostrar vista B; no hacer segunda llamada por interfaz.

**Verificación exigida:** caso unitario/flujo correspondiente GREEN normal, RED con mutación en código de producción real y GREEN tras restaurar bytes en memoria; E2E Preview cuando aplique. El prompt del comentario contiene archivos exactos y oráculos.

### PR360-H03 · MEDIO · El botón Aceptar no contempla vencimiento por expiresAt

**Archivo:** `src/features/requests/components/request-offers-list.tsx:404` · **Patrón:** `P06-enumeracion-incompleta` · **Estado:** abierto; prueba independiente NO EJECUTADA.

El texto del contador cambia a Expirada, pero isAcceptableStatus comprueba solo published; si el sweep todavía no movió el status, la UI sigue ofreciendo Aceptar. La RPC es la autoridad; la UI debe deshabilitar aceptación al vencer y evitar confirmar un modal abierto mientras expiró.

**Verificación exigida:** caso unitario/flujo correspondiente GREEN normal, RED con mutación en código de producción real y GREEN tras restaurar bytes en memoria; E2E Preview cuando aplique. El prompt del comentario contiene archivos exactos y oráculos.

### PR360-H04 · MEDIO · La navegación usa push y no acredita back/refresh sin ofertas obsoletas

**Archivo:** `src/features/requests/components/request-offers-list.tsx:157` · **Patrón:** `P01-contrato-de-framework-no-verificado` · **Estado:** abierto; prueba independiente NO EJECUTADA.

router.push deja en el historial anterior la ruta de ofertas; si el Router Cache conserva la vista vieja, Back puede mostrarla antes de revalidar. Preferir router.replace tras éxito y verificar la ruta dinámica/refresh mediante E2E real; no afirmar fallo en Next sin reproducir.

**Verificación exigida:** caso unitario/flujo correspondiente GREEN normal, RED con mutación en código de producción real y GREEN tras restaurar bytes en memoria; E2E Preview cuando aplique. El prompt del comentario contiene archivos exactos y oráculos.

### PR360-H05 · ALTO · Falta el E2E de dos sesiones aisladas y post-match

**Archivo:** `e2e/specs/main-flow.spec.ts:88` · **Patrón:** `P08-control-no-cubre-lo-que-dice` · **Estado:** abierto; prueba independiente NO EJECUTADA.

La PR no modifica e2e; el test previo usa dos pestañas del mismo browser context, no sesiones independientes ni verifica ruta, destinatarios/courier, refrescar/volver atrás. Extender el E2E existente usando dos contextos autónomos, oráculo DB único match y ausencia de contactos en courier prematch. Capturar SHA, workflow y run de Preview.

**Verificación exigida:** caso unitario/flujo correspondiente GREEN normal, RED con mutación en código de producción real y GREEN tras restaurar bytes en memoria; E2E Preview cuando aplique. El prompt del comentario contiene archivos exactos y oráculos.

### PR360-H06 · MEDIO · Tests incompletos para draft, terminal y estados stale

**Archivo:** `src/app/(merchant)/merchant/requests/[id]/page.test.tsx:130` · **Patrón:** `P08-control-no-cubre-lo-que-dice` · **Estado:** abierto; prueba independiente NO EJECUTADA.

La página nueva solo prueba published/matched/in_transit/delivered/login/404; faltan asserts reales de cancelled, expired, draft y datos mínimos permitidos, y controles de espera/errores en ofertas concurrentes; agregar casos antes del arreglo y demostrar RED→GREEN.

**Verificación exigida:** caso unitario/flujo correspondiente GREEN normal, RED con mutación en código de producción real y GREEN tras restaurar bytes en memoria; E2E Preview cuando aplique. El prompt del comentario contiene archivos exactos y oráculos.

### PR360-H07 · MEDIO · Bitácora WIP y autorrevisión declaran evidencia que no existe

**Archivo:** `docs/tasks/log/T-359.md:15` · **Patrón:** `P03-comentario-contradice-codigo` · **Estado:** abierto; prueba independiente NO EJECUTADA.

En HEAD 325a9a6 la bitácora aún dice implementación pendiente y checks ⏳; el body marca RED [x] y SIN BLOQUEANTES por el autor. Registrar resultados efectivos y cambiar información obsoleta; no certificar test ni aprobarse a sí mismo.

**Verificación exigida:** caso unitario/flujo correspondiente GREEN normal, RED con mutación en código de producción real y GREEN tras restaurar bytes en memoria; E2E Preview cuando aplique. El prompt del comentario contiene archivos exactos y oráculos.

## Lo correcto en el diff actual

- Server page consulta `getMerchantRequestWithOffers` y redirige si estado persisted matched/in_transit/delivered.
- `MerchantRequestsList` dirige published a selector y matched/in_transit a viaje.
- `RequestOffersList` evita Aceptar sobre ofertas no pendientes y hace `router.push` después del éxito; agrega badge de aceptada.
- `TripMerchantContainer` navega a solicitudes tras republicación exitosa.
- Pruebas unitarias nuevas verifican estados básicos, rutas y badge (por inspección).

## Controles y ejecución

| Chequeo | Resultado |
|---|---|
| Archivos permitidos | 8/8 por inspección |
| Test de redirects y UI | Añadidos, **no corridos por revisor** |
| Mutaciones RED→GREEN independientes | No corridas: no hay clon |
| Typecheck/lint/test | Sin ejecución atribuible al revisor; bitácora vieja ⏳ |
| E2E 2 sesiones independientes | Ausente en el diff |
| DB | Sin cambios SQL; no se levantó Supabase/Docker |
| Preview CI | No evaluada aún (bloqueantes) |
| `analizar.mjs verificacion` | Pendiente de entorno con clon |

## Decisión y control posterior

Lautaro073 eligió **B** antes de cerrar la ronda: los terminales permanecen en el detalle actual, con resumen sin datos sensibles ni acciones de aceptar; no historial automático ni pantalla nueva. No requiere nuevo CC/SQL.

El harness independiente completo se deja en `evidencia/comandos.md`. No se afirma que RED haya sido reproducido. La autorrevisión previa decía SIN BLOQUEANTES cuando su bitácora seguía WIP; corregir esa contradicción. **No aprobar ni mergear.**
