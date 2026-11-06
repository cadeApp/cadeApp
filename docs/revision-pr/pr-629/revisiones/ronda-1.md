# Informe de revisión independiente — PR #629 / T-405 · Ronda 1

**PR:** https://github.com/cadeApp/cadeApp/pull/629
**Head SHA revisado:** `ae38d57d34320a840b51db619ec6860af9cc8ed6`
**Base:** `develop` @ `fbd751aace5bcd476400ddad6ec40b29864c610f`
**Fecha:** 2026-11-06
**Resultado:** **CON BLOQUEANTES (1)**.
**Tipo de evidencia:** inspección de los archivos del SHA con conector GitHub; **no hubo ejecución local** por falta de clon/resolución DNS.

## Resumen

| # | Severidad | Ubicación | Resultado |
|---|---|---|---|
| **PR629-H01** | alto · bloqueante | `src/features/admin/components/merchant-plan-sheet.tsx:53` → `src/ui/sheet.tsx:125` | `side="right"` no alinea el panel a la derecha |
| **PR629-H02 (M01)** | bajo · mejora | `e2e/specs/publication-credits.global-settings.spec.ts:350` | fecha fija `2027-01-31` vuelve frágil el E2E |

## H01 — Sheet lateral centrado en escritorio

**Diagnóstico.** La feature renderiza `<SheetContent side="right" ...>` (`merchant-plan-sheet.tsx:53`). La implementación de `SheetContent` en `src/ui/sheet.tsx:125` usa un wrapper con clases `fixed inset-0 z-50 flex items-end justify-center sm:items-center`. El prop `side` solo afecta altura, anchura y bordes de `DialogPrimitive.Content` (`:131–137`); no cambia `justify-center`. Por lo tanto, un contenido de ancho menor que el viewport queda centrado, contra A03 y DoD de T-405. También consume ese componente `src/app/(admin)/admin-nav.tsx`.

**Cobertura existente insuficiente.** `merchant-plan-sheet.test.tsx:62–64` solo prueba el atributo `data-sheet-side="right"`, no geometría ni justificación del wrapper. Esto es un control proxy: P08-control-no-cubre-lo-que-dice.

**Evidencia:** [ANÁLISIS POR INSPECCIÓN], no reproducción con navegador. El código y las líneas anteriores fueron leídos desde el SHA revisado. No se inventa RED/GREEN.

**Arreglo aprobado por Lautaro073: D04=B.** No tocar `src/ui/**` en T-405. Crear **CC liviano independiente**, seguimiento [#630](https://github.com/cadeApp/cadeApp/issues/630), que habilite `src/ui/sheet.tsx` más test propio y regresión del menú admin. En el wrapper, aplicar `side === 'right' ? 'justify-end' : 'justify-center'` mediante `cn`, conservando el resto de clases y la alineación `bottom`. No modificar estado/foco/animación por accidente. Añadir test que verifique la clase del wrapper y mutación RED sustituyendo `justify-end` por `justify-center`. Confirmar con Playwright la posición física del borde derecho a 1280 y 390 px. El CC se mergea primero a `develop`.

**Dependencia T-405:** tras el merge del CC, integrar `develop` mediante merge, agregar comprobación geométrica real al E2E existente en el momento en que el Sheet es visible: obtener `boundingBox()` del diálogo y `viewportSize()` de la página y afirmar que `box.x + box.width` coincide con el ancho visible con tolerancia máxima de 2 px. No alcanza con afirmar `data-sheet-side`.

**Cómo revalidar:** fixture React/Playwright del componente compartido y test E2E de T-405, contra la rama del CC mergeada; control verde, mutación temporal roja y restauración en memoria. Revisar CI oficial y el gate `e2e-preview` del SHA funcional, no confundir el commit de revisión documental con un cambio funcional.

**Estado:** abierto; bloquea la PR hasta el CC mergeado y E2E geométrico.

## M01 — Fecha fija vuelve obsoleto el escenario

**Diagnóstico.** `publication-credits.global-settings.spec.ts:350` fija `pilotUntil = '2027-01-31'` y comprueba literalmente `31/01/2027` en el panel y Auditoría. Pasado ese día, el test deja de representar una **extensión futura** del piloto. No es un fallo observado hoy ni un bloqueo actual.

**Evidencia:** [ANÁLISIS POR INSPECCIÓN].

**Arreglo asignado al autor de T-405:** solo `e2e/specs/publication-credits.global-settings.spec.ts`. Generar fecha civil futura por UTC, p. ej. 60 días a partir del momento de la prueba:
~~~ts
const future = new Date();
future.setUTCDate(future.getUTCDate() + 60);
const pilotUntil = future.toISOString().slice(0, 10);
const pilotUntilDisplay = pilotUntil.split('-').reverse().join('/');
~~~
Conservar el `pilotUntil` dinámico tanto en la escritura como en la expectativa de base, y usar `pilotUntilDisplay` en **ambas** aserciones UI/auditoría. Si el dominio impone otro horizonte máximo, usar una fecha futura dentro del límite documentado.

**Pruebas:** E2E real y mutación temporal del cálculo a fecha pasada para verificar que la prueba detecta el incumplimiento funcional; **no alterar ni debilitar expectations para pasar en verde**. Evitar pruebas falsas, mocks que eviten producción y hardcodes alternativos.

**Estado:** mejora abierta; Lautaro073 confirma que la aplicará en esta PR.

## Decisiones aceptadas (sin decisiones pendientes)

- **D01=A:** `getMerchantPlanMovementsAction` bajo demanda y ampliación acotada de `actions.ts` + test autorizadas.
- **D02=A:** etiqueta «Abono y piloto».
- **D03=A:** `pilot → default` y `active → verified`.
- **D04=B:** CC separado para primitiva `Sheet`; issue #630. La PR T-405 depende de su merge y luego de la prueba geométrica Playwright.

## Lo comprobado por inspección

- Cinco conteos exactos con `head: true` y el mismo `!inner` que tabla; el total no filtra el estado.
- La tabla filtra `subscription_status` y conserva `status` en paginación.
- Los últimos movimientos filtran `target_type`, `target_id` y `action` antes de `order id desc` y `limit(5)`; usa saneamiento de T-400.
- La action valida Zod y llama a `requireAdminAal2` antes de leer.
- No se detectó acceso nuevo directo a `merchant_plan_periods` ni cambios en `supabase/**`.
- Se registró que `actions.ts` y `actions.test.ts` no estaban permitidos en la ficha de `develop`, pero D01 los autorizó expresamente: no queda desvío pendiente por esos dos archivos.

## NO TOCAR en T-405

- No modificar `src/ui/sheet.tsx` ni test de primitiva desde la rama T-405; pertenece a CC #630.
- No cambiar contratos, dependencias, RLS, migraciones, keys ni infraestructura.
- No deshacer D01–D03 ni reinterpretar como fallos las decisiones ya resueltas.

## Controles no ejecutados / límites

- `pnpm typecheck`, `pnpm lint`, `pnpm test`: el autor declara verde; **la revisión no reprodujo**.
- `e2e-preview` y CI: no verificados en esta ronda, que ya tiene bloqueantes.
- Pruebas RED previas y mutaciones M1–M7 declaradas por bitácora: **no reproducidas independientemente**.
- `git merge-tree --write-tree origin/develop HEAD`, `git log` de la carpeta y controles de ramas remotas: **no ejecutados** porque el contenedor no puede resolver GitHub para clonar/fetchear.
- Estado GitHub: PR abierta, mergeable al consultar API, no equivale a verificación mecánica.
- No se atribuyen resultados locales ni `verificado_en_sha` ficticios. Todo sigue abierto hasta ronda posterior.

## Checklist para ronda 2

- [ ] CC #630 implementado, probado, revisado y mergeado en `develop`.
- [ ] T-405 actualizada con merge de `develop`, sin rebase/force/amend.
- [ ] M01 implementada con fecha UTC futura dinámica y expectativas coherentes.
- [ ] E2E de T-405 con aserción geométrica en 1280 px y viewport angosto.
- [ ] Ejecutar controles limpios, mutaciones **independientes del revisor**, CI y `e2e-preview` en SHA funcional.
- [ ] Comprobar de nuevo head, comentarios, bitácora, alcance y `merge-tree` antes de reabrir revisión.

**Conclusión:** CON BLOQUEANTES (1); no aprobar ni mergear.
