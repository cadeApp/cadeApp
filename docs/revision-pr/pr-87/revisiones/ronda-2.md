# Ronda 2 — PR #87 (T-118) — Revisión independiente

- **SHA revisado:** \`225cd08f63d92dbaa9e6c5371b54c9ffa0c82e78\`
- **develop:** \`b6bdac6cfe4c5ac9227e87692b8572e1f6bc2121\`
- **Fecha:** 2026-09-24
- **Comparación con R1:** 8 commits después de \`4a6a91f\`; develop ya fue mergeado; GitHub reporta PR mergeable.
- **CI:** no abierto en esta ronda porque persisten bloqueantes.
- **Checks locales independientes:** no ejecutables en este runtime (sin checkout/red git).

## Informe formato revisar-pr

~~~text
Informe revisar-pr — T-118 — 2026-09-24 — generado por revisión independiente
Resultado: CON BLOQUEANTES (15) + 1 DECISIÓN DE ALCANCE
Checks locales: typecheck ⚪ no ejecutado · lint ⚪ no ejecutado · test ⚪ no ejecutado · test:db n.a.
BLOQUEANTES:
- [src/app/(public)/layout.tsx:11-23; src/features/auth/guards.ts:239,246] (PR87-H01) residual: el footer público sigue enlazando /terms y /privacy inexistentes y las guardas admin todavía emiten /admin y /admin/mfa inexistentes → eliminar/desactivar links legales con aviso T-311 y hacer que todas las redirecciones emitidas hoy resuelvan a rutas existentes.
- [src/features/merchants/queries.ts:16,50; src/app/(merchant)/merchant/plan/page.tsx:20-60,122] (PR87-H02) C08 consulta datos reales pero usa un enum inventado trial|active|grace_period|suspended; la DB es pilot|active|expired|cancelled y pilot es el default → tipar/mapear el contrato real y cubrir los 4 estados con prueba; hoy pilot deja getSubscriptionDisplay() sin retorno y rompe el render.
- [src/app/(courier)/courier/profile/page.tsx:42-56; src/features/courier-onboarding/components/courier-profile-view.tsx:92-118] (PR87-H03) R08 interpreta pending/approved/valid, pero la DB entrega none|submitted|verified|rejected → mapear submitted/verified correctamente; hoy un documento verificado se muestra “No cargado”.
- [src/features/requests/queries.ts:185-194; src/features/merchants/queries.ts:75-77; src/app/(courier)/courier/profile/page.tsx:15-39] (PR87-H06) los error.tsx existen, pero las lecturas tragan errores DB como []/null o ignoran Result.error → distinguir “sin fila” de “falló la consulta” y propagar el error para que el boundary sea alcanzable.
- [src/app/(public)/layout.tsx:23] (PR87-H07) queda text-xs (12 px) en el shell público → llevarlo a text-sm y ampliar el control a todo el alcance visual.
- [src/app/route-integrity.test.ts:163-260] (PR87-H09) los 50 tests siguen midiendo una enumeración parcial/source matching: están verdes aunque public/layout tenga links/text-xs, C08/R08 tengan enums incompatibles y los error boundaries sean inalcanzables → probar la clase completa y comportamiento/contratos, no sólo presencia de strings/archivos.
- [PR #87 body/comments; docs/tasks/log/T-118.md:42] (PR87-H10) sigue sin haber capturas side-by-side; la bitácora declara 390 y 1280, no el control obligatorio 360 → adjuntar evidencia real P/C/R a 390 y 360 y los estados/controles exigidos.
- [PR #87 body] (PR87-H11) el body real sigue fuera de plantilla; docs/revision-pr/pr-87-body.md no sustituye editar la PR y además marca checks falsos → actualizar el body real con la plantilla y evidencia vigente.
- [src/ui/brand-logo.tsx; src/ui/button.tsx; src/ui/top-bar.tsx; src/ui/ui-system.test.tsx] (PR87-H08 + PR87-A01) se corrigieron estilos modificando directamente src/ui/** dentro de T-118, sin contract-change aprobado, pese a que ficha y R1 lo prohibían → sacar esos cambios de T-118 o integrarlos primero mediante CC separado aprobado y mergeado.
- [src/features/requests/components/merchant-history-view.tsx:55-62,148,207] (PR87-R01) C07 filtra después de paginar; si la página cargada no tiene “Entregadas” pero la siguiente sí, muestra vacío y oculta nextCursor → filtro por estado debe viajar en searchParams y aplicarse en servidor antes del limit/cursor.
- [src/features/requests/queries.ts:150-168,226-257; MerchantRequestsList métricas] (PR87-R02) la paginación compartida limita métricas C02 a 50 filas y avgRateArs queda fijo en 0 aunque se muestra como “Tarifa promedio” → separar query/listado de historial de las métricas globales o calcular métricas con consulta agregada real.
- [src/app/(merchant)/merchant/history/page.tsx:9,30-38; src/features/requests/queries.ts:170-173] (PR87-H13) cursorCreatedAt/cursorId llegan de URL sin Zod y se interpolan en .or() → parsear searchParams con schema y rechazar/normalizar cursor inválido.
- [src/app/(merchant)/merchant/dashboard/page.tsx:17-27] (PR87-H14) C02 hace select('id, name') sobre merchants, pero el contrato sólo tiene profile_id/business_name; la consulta falla y puede redirigir un comercio válido al onboarding → usar columnas reales y testear la query canónica.
- [src/app/(merchant)/merchant/plan/page.tsx:100; CourierProfileView:156; src/ui/button.tsx:10-16] (PR87-H15) se usa buttonVariants({variant:'primary'}) pero Button no define primary → usar una variante existente (normalmente default) y agregar cobertura.
- [docs/revision-pr/pr-87-body.md; body real] evidencia declarada contradictoria: el archivo preparado marca “Sin cambios fuera de Archivos permitidos” y capturas verificadas aunque el diff tiene src/ui fuera de alcance y el PR real no tiene imágenes → corregir sólo después de cerrar alcance/evidencia.
MEJORAS:
- ninguna; primero cerrar bloqueantes.
No revisado / dudas para Lautaro073:
- 🔵 PR87-A02: src/features/requests/index.ts está fuera de la ficha, pero C07 necesita exportar MerchantHistoryView por el barrel para no hacer deep import prohibido. Autorizar ese archivo en la ficha/CC de alcance, o definir otra API pública permitida; el agente no debe decidirlo solo.
- H04, H05 (defecto original) y H12 quedaron arreglados-verificados en 225cd08. H05 generó R01/R02 separados.
- CI no se inspeccionó por regla mientras haya bloqueantes.
~~~

## Estado de R1 revalidado

- **Cerrados y verificados:** H04, H05 (defecto original), H12.
- **Parciales:** H01, H02, H03, H06, H07, H08, H09.
- **Abiertos:** H10, H11.
- **Nuevos R2:** A01, A02(decisión), R01, R02, H13, H14, H15.

## Evidencia clave

1. **Contratos DB:** merchant_subscription_status es \`pilot|active|expired|cancelled\` (pilot default); document_review_status es \`none|submitted|verified|rejected\`. El código de C08/R08 usa valores diferentes.
2. **Alcance:** cuatro \`src/ui/**\` fuera de alcance sin CC; \`requests/index.ts\` fuera de ficha.
3. **Control incompleto:** \`public/layout.tsx\` tiene tres links legales rotos y \`text-xs\`, pero no está en los arrays auditados de H01/H07.
4. **Error boundaries:** existen archivos, pero errores DB se convierten en estados vacíos.
5. **C07:** no hay prueba de 51 filas/segunda página; filtro se hace después del page slice.
6. **C02:** query de merchant usa columnas inexistentes y métricas quedan afectadas por el limit compartido.
7. **PR real:** body sigue viejo, sin plantilla ni capturas; el archivo local \`pr-87-body.md\` no fue aplicado.

## Prompt acotado para el arreglo

~~~text
Tarea: T-118, PR #87. Primero git pull para traer la Ronda 2. No rebase, amend ni force-push.

NO TOQUES docs/revision-pr/pr-87/** ni marques hallazgos como verificados.

1) Alcance:
- Revertí de T-118 los cambios de src/ui/brand-logo.tsx, src/ui/button.tsx, src/ui/top-bar.tsx y src/ui/ui-system.test.tsx a origin/develop.
- Si la fidelidad del logo/TopBar/Button realmente requiere esos cambios, abrí contract-change separado y no continúes esa parte hasta que esté aprobado/mergeado.
- 🔵 No decidas src/features/requests/index.ts: esperá decisión de Lautaro sobre autorizar el barrel o una API pública alternativa.

2) H01/H07/H09:
- Incluí src/app/(public)/layout.tsx en la auditoría. Quitá links reales a /terms,/privacy mientras T-311 no exista y reemplazalos por texto explícito “en publicación · T-311”.
- 0 text-xs en TODO el alcance T-118.
- Revisá evaluateRouteGuard: ningún redirectTo emitido actualmente puede apuntar a /admin o /admin/mfa inexistentes.
- Test de clase completa: mutar cualquier href/redirectTo a una ruta inexistente o text-sm→text-xs debe dar rojo.

3) H02:
- Usá el enum real merchant_subscription_status: pilot|active|expired|cancelled (idealmente tipo derivado del contrato, sin modificar database.types).
- getSubscriptionDisplay cubre exhaustivamente los 4 estados.
- Test unitario de getMerchantAccountProfile/C08 con pilot, active, expired, cancelled; pilot es default DB. Error DB debe lanzar para activar error.tsx; “sin merchant” puede devolver null.
- Mutá pilot→trial y la prueba debe caer.

4) H03:
- Usá document_review_status real: none|submitted|verified|rejected.
- DNI combinado: rejected domina; si ambos verified => verified; si alguno submitted => submitted; si falta/no cargado => none según contrato.
- CourierProfileView debe renderizar submitted=En revisión, verified=Validado por admin.
- Error de cualquiera de profile/courier/documents debe propagarse al error boundary.
- Agregá tests de CourierProfileView/mapper con los 4 estados.

5) H06:
- En queries/pages con error.tsx, no conviertas error de Supabase en EmptyState. Diferenciá error de ausencia real.
- Tests: error DB => reject/throw; 0 filas sin error => vacío honesto. Mutar throw por []/null debe dar rojo.

6) H05/R01/R02/H13:
- No reutilices una única query paginada para C07 y métricas globales C02 si cambia su semántica.
- C07: searchParams validados con Zod para status, cursorCreatedAt, cursorId; aplicar status en DB ANTES de limit/cursor. Tabs deben reflejar URL.
- Agregá queries.test.ts con 51+ filas, segunda página, empate created_at por id, filtro que sólo tiene resultados en página 2, cursor inválido.
- C02: métricas globales correctas, no limitadas a la página; Tarifa promedio debe ser dato real o no mostrarse, nunca $0 inventado.
- Mutaciones: quitar limit/cursor/status o volver avgRateArs=0 fijo debe dar rojo.

7) H14:
- Dashboard usa merchants.profile_id/business_name, no id/name. Chequeá y propagá error de consulta; sólo ausencia real redirige onboarding.
- Test canónico con contrato actual.

8) H15:
- Reemplazá variant:'primary' por una variante existente de Button (default si corresponde). No agregues primary a src/ui desde T-118.

9) H10/H11:
- Ejecutá browser REAL a 390 y 360 (1280 es adicional, no reemplaza 360) y adjuntá side-by-side Stitch/implementación para P/C/R al PR real, con loading/vacío/error/pending, foco/teclado/contraste/targets/safe-area/reduced-motion.
- Editá el BODY REAL de PR #87 usando .github/pull_request_template.md; no alcanza docs/revision-pr/pr-87-body.md.
- No marques “Sin cambios fuera de alcance” ni capturas hasta que sea verdad.
- Actualizá números de tests al run final.

10) Pruebas:
- pnpm typecheck && pnpm lint && pnpm test && pnpm build.
- Mostrá rojo/verde de las pruebas nuevas/mutaciones.
- Bitácora: hecho/pruebas/falta, sin escribir “verificado”.
- Push y pegá git ls-remote origin feat/T-118-integracion-visual-stitch.
~~~
