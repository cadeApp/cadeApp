# Ronda 1 — PR #87 (T-118) — Revisión independiente

- PR: #87 · feat/T-118-integracion-visual-stitch → develop
- Tarea: T-118 · ficha leída desde origin/develop
- Autor: Lautaro073
- SHA revisado: 027f39e0ca5f010710142abc9d6ec5e189684ecf
- develop al revisar: b6bdac6cfe4c5ac9227e87692b8572e1f6bc2121
- Fecha: 2026-09-24
- Rama: 3 commits delante y 2 detrás de develop; GitHub informa mergeable.
- Comentarios previos del PR: ninguno.
- Autor en docs/revision-pr/pr-87/: no; la carpeta no existía antes de esta ronda.

## Informe formato revisar-pr

~~~text
Informe revisar-pr — T-118 — 2026-09-24 — generado por revisión independiente
Resultado: CON BLOQUEANTES (12)
Checks locales: typecheck ⚪ no ejecutado · lint ⚪ no ejecutado · test ⚪ no ejecutado · test:db n.a.
BLOQUEANTES:
- [src/features/auth/guards.ts:23-24; src/app/page.tsx:155-163; src/features/auth/components/register-form.tsx:169-173] (PR87-H01) getRoleDefaultPath('admin') devuelve /admin aunque no existe; P01/P03/C08/R08 enlazan /terms y /privacy, también inexistentes, sin identificar esos enlaces como pendientes de T-311 → todo destino emitido debe existir; para legales pendientes, retirar el enlace roto o marcar explícitamente el estado pendiente permitido por la ficha.
- [src/app/(merchant)/merchant/plan/page.tsx:23-32] (PR87-H02) C08 siempre muestra “Piloto activo / Estás en el piloto gratis” sin consultar subscription_status/paid_until → leer el estado real permitido por RLS o mostrar un estado vacío/error honesto.
- [src/app/(courier)/courier/profile/page.tsx:38-42; src/features/courier-onboarding/components/courier-profile-view.tsx:91-130] (PR87-H03) R08 convierte ausencia de fila en moto+approved y muestra Aprobado, DNI Verificado y Selfie Verificada de forma fija → no fabricar estado; mapear courier/documentos reales o estado vacío/pending/rejected.
- [src/features/requests/queries.ts:36,206-207] (PR87-H04) C07 transforma distancia nula en 1,0 km y joins de zona ausentes en Centro/Aguilares → conservar ausencia/unknown y renderizarla honestamente.
- [src/features/requests/queries.ts:133-151; src/app/(merchant)/merchant/history/page.tsx:26] (PR87-H05) C07 reutiliza getMerchantRequests sin limit/range/cursor y carga todo el historial → paginar a máximo 50 con cursor created_at/id.
- [src/app/(merchant)/merchant/**; src/app/(courier)/courier/**] (PR87-H06) las 8 rutas canónicas con lecturas de servidor auditadas no tienen loading.tsx ni error.tsx; los loading existentes quedaron bajo aliases /requests/** → crear/mover boundaries canónicos con Skeleton y estado de error.
- [src/app/(merchant)/layout.tsx:12; src/app/(merchant)/merchant/plan/page.tsx:25,43,88,99; src/features/courier-onboarding/components/courier-profile-view.tsx:50-63,91,108,119,129,153,176; src/features/requests/components/merchant-history-view.tsx:101-140,178,188] (PR87-H07) hay 15 usos de text-xs, un switch R08 de 28 px de alto y cuatro tabs C07 de 40 px → respetar piso 14 px y targets de 48 px de la ficha/directiva.
- [src/app/(merchant)/layout.tsx:17-26; src/app/(courier)/layout.tsx:9-18; src/app/(merchant)/merchant/plan/page.tsx:74] (PR87-H08) se agregaron dos bloques style con hex/important y text-[#25D366]; la bitácora dice que fueron workaround para no tocar src/ui → abrir contract-change para BrandLogo inverse/token y quitar CSS suelto/valores arbitrarios después de integrarlo.
- [src/app/route-integrity.test.ts:110-218] (PR87-H09) el control no enumera admin/legal, estados verificados ni la hoja real de R08; agregar “CBU” a CourierProfileView deja verde el test actual porque solo lee profile/page.tsx → probar la unidad renderizada y enumerar la clase completa.
- [PR #87 body/comments; docs/tasks/log/T-118.md:17-22] (PR87-H10) no hay capturas Stitch-vs-implementación a 390 px ni control 360 px, ni evidencia browser de foco/teclado/contraste/estados; la bitácora declara la tarea terminada → adjuntar la evidencia exigida antes de cerrar el DoD.
- [PR #87 body] (PR87-H11) el cuerpo no sigue .github/pull_request_template.md: faltan DoD, evidencia de checks en la sección estándar, Informe revisar-pr y Rollback → restaurar la plantilla oficial.
- [docs/tasks/log/T-118.md:22] (PR87-H12) la sesión final declara “Último commit: 4d30851”, SHA que no existe en el remoto → actualizar la bitácora con un SHA realmente publicado.
MEJORAS:
- ninguna en esta ronda; primero cerrar los bloqueantes.
No revisado / dudas para Lautaro073:
- CI de 027f39e no se inspeccionó: con bloqueantes la ronda queda en revisión estática + controles propios.
- No se ejecutaron pnpm typecheck/lint/test/build por falta de checkout/red git. Los verdes del cuerpo/bitácora son evidencia del autor, no verificación independiente.
~~~

## Alcance y base

- La ficha T-118 se leyó desde origin/develop actual.
- La PR modifica docs/tasks/T-118.md, pero su diff solo marca casillas [ ] → [x]; no amplía alcance.
- develop avanzó dos commits y agregó/actualizó la directiva visual de T-118; la rama debe mergear origin/develop.
- Los 44 archivos de la PR entran en los globs permitidos. No hay dependencia nueva ni cambios de src/ui, src/domain o migraciones.
- GitHub reporta mergeable; no se detecta conflicto actual.

## Reproducción de la evidencia roja del autor

El commit rojo da34d18619a8012ba697d7b8f971a0f866042413 existe y agrega route-integrity.test.ts + bitácora. En ese árbol la comprobación estructural encontró:

- 16 archivos en requiredFiles; 14 faltaban.
- P01 todavía tenía “Fase 0 · Scaffold mínimo operativo (T-000)”.
- registerAction no contenía /merchant/onboarding ni /courier/onboarding/identity.

Esto corrobora objetivos rojos reales. No se afirma haber reproducido el contador exacto “21 fallos” de Vitest porque no hubo runner local y, con bloqueantes, no se usó CI como sustituto.

## Batería independiente

Mutación principal de P08:
- baseline del control R08 del autor: GREEN;
- mutación en memoria: agregar “CBU” a CourierProfileView;
- control del autor: GREEN otra vez;
- control independiente que incluye la hoja renderizada: RED.

Otros resultados mecánicos:
- admin default=/admin, sin página /admin y sin test getRoleDefaultPath("admin");
- referencias legales /terms y /privacy sin páginas físicas;
- C08 no accede a subscription_status/paid_until;
- R08 tiene fallback approved y verificaciones fijas;
- C07 usa 1,0/Centro/Aguilares y no pagina;
- 8 segmentos canónicos con datos: 0 loading.tsx y 0 error.tsx;
- 15 text-xs, switch h-7 y 4 tabs min-h-10;
- 2 bloques style y text-[#25D366];
- cuerpo del PR sin capturas y sin las secciones obligatorias de la plantilla.

Detalle reproducible en ../evidencia/comandos.md.

## Prompt acotado para el arreglo

~~~text
Tarea: T-118, PR #87, rama feat/T-118-integracion-visual-stitch.
0. git pull (trae el commit de la revisión indicado en el comentario). Sin rebase, force-push ni amend.
1. git fetch origin && git merge origin/develop. En docs/tasks/T-118.md gana la versión actual de develop; conservá solo checks que realmente queden cumplidos.

Podés tocar SOLO:
- src/features/auth/guards.ts
- src/app/route-integrity.test.ts
- src/app/page.tsx
- src/features/auth/components/register-form.tsx
- src/app/(merchant)/layout.tsx
- src/app/(courier)/layout.tsx
- src/app/(merchant)/merchant/plan/page.tsx
- src/app/(courier)/courier/profile/page.tsx
- src/features/courier-onboarding/components/courier-profile-view.tsx
- src/features/requests/queries.ts
- src/features/requests/components/merchant-history-view.tsx
- los loading.tsx y error.tsx exactos bajo rutas canónicas de merchant/courier que tengan datos
- docs/tasks/log/T-118.md
- el body/comentarios del PR para plantilla y evidencia visual.

Prohibido:
- docs/revision-pr/** (es de la revisión)
- src/ui/** o src/domain/** dentro de T-118
- marcar hallazgos como verificados
- crear otros archivos nuevos (scripts auxiliares van en /tmp)
- dependencias nuevas
- rebase, amend o force-push
- ampliar la ficha.

Pasos:
1. H01: enumerá TODOS los href/router.push/redirectTo/getRoleDefaultPath del alcance y resolvelos contra el árbol. Mutación: cada familia de destino → /ruta-inexistente y el test debe caer.
2. H02/H03/H04: eliminá datos fantasma C08/R08/C07 y probá estados reales, ausencia y error. Reintroducir cada fallback/fijo debe dar rojo.
3. H05: paginá C07 a máximo 50 con cursor created_at/id. Quitá limit/range/cursor y la prueba debe caer.
4. H06: agregá loading/error canónicos con Skeleton de src/ui. Quitar cada boundary debe romper el control.
5. H07: 0 text-xs en pantallas T-118 y targets auditados >=48 px. Mutación text-sm→text-xs y h-12→h-7: rojo.
6. H08: NO toques src/ui desde T-118. Abrí contract-change para BrandLogo inverse y token compartido; tras mergearlo, eliminá style locales y text-[#25D366].
7. H09: ampliá route-integrity a la hoja/dependencias reales y toda la clase. La mutación CBU en CourierProfileView tiene que quedar roja.
8. H10: verificá browser real 390/360 P/C/R y adjuntá comparativas + loading/vacío/error/pending, teclado, foco, contraste, targets, safe areas y reduced motion en PR + bitácora.
9. H11: restaurá el body según .github/pull_request_template.md. La sección Informe revisar-pr queda para la revisión independiente; no escribas un APTO propio.
10. H12: corregí Último commit de bitácora con SHA publicado.

No resuelvas los 🔵: no hay decisiones abiertas en esta ronda.
Al terminar: bitácora (hecho / pruebas / falta; no escribas “verificado”), commit [T-118], push y pegá git ls-remote origin feat/T-118-integracion-visual-stitch.
~~~
