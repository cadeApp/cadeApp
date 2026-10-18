# Ronda 3 — PR #410 / T-355 — 2026-10-18

**Informe revisar-pr — T-355 — 2026-10-18 — revisión independiente, Ronda 3**  
**Resultado: SIN BLOQUEANTES DE CÓDIGO T-355 · CON BLOQUEANTE DE INTEGRACIÓN/CI (1): PR410-H11.**  
**SHA de código revisado:** `843bd2b851ad65f74866e588c2b9993279f1a343`. Base: `develop` actualizado con CC-031, y un commit posterior en develop que solo aumenta el timeout del workflow E2E. PR abierta, mergeable según GitHub, NO aprobada ni mergeada.

## Revisión de correcciones solicitadas (Ronda 2)

**H09 (BLOQUEANTE DE CÓDIGO) — CERRADO Y VERIFICADO EN `843bd2b851ad65f74866e588c2b9993279f1a343`.**

La autora cambió exactamente los 3 archivos indicados y no debilitó las aserciones:
- `src/app/(courier)/courier/profile/page.test.tsx:266`: reemplazó `(profile as any).dniHash` por `expect(profile).not.toHaveProperty('dniHash')`; retuvo assertions de `hasDniOnFile` y de ausencia del HMAC/prefijo serializado.
- `src/features/courier-onboarding/components.test.tsx:909-910`: eliminó `!`, añadió `if (!personalCard) throw new Error(...)`, retuvo `within(personalCard)`.
- `e2e/specs/authorization.spec.ts:324-327,390-391`: conservó aserciones iniciales y añadió el guard TS explícito `if (!initialProfile) throw ...` antes de leer `phone`; sustituyó los dos accesos `initialProfile!` por accesos sin aserción. La UI y las expectativas E2E siguen intactas.
- El agente declara una verificación estática de sensibilidad: código corregido GREEN y tres reintroducciones mutadas detectadas RED en memoria. **No reproduje las mutaciones localmente**; sí contrasté las expresiones corregidas en el SHA exacto y los checks `typecheck`, `lint`, `unit` de CI verdes. Los `as any` antiguos ajenos a T-355 no fueron cambiados por esta ronda.

**H10 (MEJORA NO BLOQUEANTE) — ACEPTADO CON JUSTIFICACIÓN TÉCNICA.**
`src/features/courier-onboarding/actions.ts:521` ahora usa `const patch: TablesUpdate<'profiles'> = { phone: parsed.data.phone }`, que verifica las claves y el tipo del payload contra los tipos generados. La llamada conserva `.update(patch as never)` como escape de inferencia del cliente. El `typecheck` CI pasa. No inventar una fuga ni demandar cambiar tipos generados; mejorar el límite de tipado en otra tarea si la librería lo permite.

**H04, H05 y H08 (E2E de T-355) — EVIDENCIA FUNCIONAL VERIFICADA.**
El job [117737516829](https://github.com/cadeApp/cadeApp/actions/runs/39148607765/job/117737516829) del **SHA `843bd2b851ad65f74866e588c2b9993279f1a343`** muestra expresamente **test #5 `✓` a las 17:18:22Z**, `e2e/specs/authorization.spec.ts:305`, caso «T-355: Repartidor actualiza exclusivamente su teléfono desde /courier/profile con persistencia tras recargar» (23,0 s). El código comprueba lectura inicial, precarga, persistencia tras reload y en segunda sesión y restauración en finally. Ya había una ejecución completa de la suite **88 chromium + 3 global-settings PASS** sobre el HEAD anterior `d3b5070` ([run 39108468053](https://github.com/cadeApp/cadeApp/actions/runs/39108468053)), cuyo cambio posterior en E2E es solo el guard de tipos H09; no atribuir a ese run el SHA más nuevo.

## H11 — NUEVO BLOQUEANTE DE INTEGRACIÓN (NO atribuible a T-355)

**HECHO A: cancelación real por timeout anterior de 30 minutos.**

- Último workflow [39148607765](https://github.com/cadeApp/cadeApp/actions/runs/39148607765): `e2e-preview=error`, run `conclusion=cancelled`.
- Job `117737516829` comenzó `2026-10-18T17:16:15Z`, terminó `17:46:32Z` (aprox. 30 min). Mensaje final exacto: `The operation was canceled.`.
- Archivo `.github/workflows/e2e-preview.yml` en base de `develop` al ejecutar establecía `timeout-minutes: 30`; **el commit nuevo `7a428bde5aa213ce976e9fabbc3e1d6e03ad9942` en develop ya lo aumenta a `45`**. Cambio verificado en los dos archivos. No repara retroactivamente el run previo; solo rige corridas futuras.

**HECHO B: la cancelación no es la única señal del log.**

Antes de terminar, Playwright había registrado **30 intentos `✘` sobre 10 casos distintos** (tres intentos por caso), distribuidos entre `fixed-price.spec.ts` (3 casos, T-339), `main-flow.spec.ts` (2, T-303), `map-privacy.spec.ts` (2, T-314), `multi-drop.spec.ts` (2, T-340/T-353) y `request-states.spec.ts` (1, T-304). Los `✘` son fallos observados de otras suites, **no de T-355**. Al interrumpirse no hubo reporte Playwright final ni artifact; faltan los stack traces para determinar causas. No afirmar que ampliar a 45 min garantiza éxito. Una ejecución futura tiene que verificar si persisten errores funcionales o si fueron transitorios/de entorno.

## Comprobaciones de código/CI

- Cambios de la autora desde el commit documental `d3b5070`: 6 rutas (exactamente `docs/tasks/T-355.md`, `docs/tasks/log/T-355.md`, `e2e/specs/authorization.spec.ts`, `page.test.tsx`, `actions.ts`, `components.test.tsx`); **dentro del alcance**. No modificación de `supabase/**`, workflows, contracts, secrets ni fixtures ajenas a T-355.
- [CI principal 39148535044](https://github.com/cadeApp/cadeApp/actions/runs/39148535044): `typecheck`, `lint`, `unit`, `build`, `audit`, `bundle-budget`, `db-tests` SUCCESS. `approval-policy` también SUCCESS. Vercel READY.
- `e2e-preview`: **ERROR (run cancelled con 30min)** a pesar de caso T-355 individual `✓`. El nuevo límite de 45 minutos en develop se verificó, no se ejecutó aún un E2E completo con ese límite sobre este SHA al cierre de inspección.
- `develop` está un commit por delante de la rama T-355 debido únicamente al cambio del timeout, sin conflictos de merge reportados (`mergeable=true`).
- Revisión efectuada mediante GitHub API, código y logs de CI. No ejecuté Docker, Playwright, TypeScript, mutaciones ni comandos remotos administrativos por fuera de los runners ya existentes.

## Veredicto y condiciones de cierre

**Producto/seguridad de T-355: no quedan bloqueantes de código conocidos; H09 cerrado y el test E2E específico del SHA revisado pasó.**  
**Merge: NO TODAVÍA**, porque el gate global `e2e-preview` no está verde. El límite a 45 min corrige la **posibilidad de cancelación por 30 min**, pero el log contiene 10 casos ajenos fallidos que deben quedar PASS en ejecución completa o investigarse antes de un merge normal.

**Siguiente acción sin editar test ajeno:** dejar correr un nuevo `e2e-preview` disparado normalmente por Vercel contra el workflow confiable de `develop` con `timeout-minutes:45`; comparar resultado, SHA, artifacts y diez casos antes fallidos. Si el gate vuelve a fallar, gestionar diagnóstico en zona/issue correspondiente, sin retocar umbrales, workflows o mocks para «verde» y sin volver a culpar a la funcionalidad de T-355 sin evidencia.

No aprobar, mergear ni forzar checks desde la revisión.
