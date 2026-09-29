# Ronda 5 — PR #87 (T-118) — Revisión independiente

- **SHA revisado:** `bdece0f187e0f6d9dd480844c5942008d8391f8d`
- **develop:** `b6bdac6cfe4c5ac9227e87692b8572e1f6bc2121`
- **Fecha:** 2026-09-25
- **Desde R4:** 1 commit de implementación después de `61c79e2`; 7 archivos tocados; `docs/revision-pr/pr-87/**` intacto.
- **GitHub:** PR mergeable al iniciar/cerrar la inspección.
- **CI:** no inspeccionado porque persiste 1 bloqueante.
- **Checks locales del proyecto:** no ejecutables en este runtime sin checkout del repo. Se ejecutó un probe aislado de JavaScript sobre las regex de H09.

## Informe formato revisar-pr

~~~text
Informe revisar-pr — T-118 — 2026-09-25 — generado por revisión independiente
Resultado: CON BLOQUEANTES (1)
Checks locales: typecheck ⚪ no ejecutado · lint ⚪ no ejecutado · test ⚪ no ejecutado · test:db n.a.
BLOQUEANTES:
- [src/app/route-integrity.test.ts:111-116; src/app/(merchant)/merchant-nav.tsx:16-41; src/app/(courier)/courier-nav.tsx:16-37; src/features/requests/components/merchant-history-view.tsx:238-251] (PR87-H09) el scanner ya detecta JSX/templates directos, pero no destinos indirectos que el código real emite: objetos `href: '/...'`, `href={buildNextCursorHref(...)}`, retornos de helpers ni `router.push(targetUrl)`. Mutación: agregar un cuarto navItem `href:'/ghost'` manteniendo los tres canónicos deja verde el control actual.
MEJORAS:
- ninguna; cerrar H09 y recién entonces abrir CI.
No revisado / dudas para Lautaro073:
- ninguna decisión de alcance pendiente. A01/A02 siguen aceptadas.
- CI no se inspeccionó por regla mientras exista el bloqueante H09.
~~~

## Revalidación de R4

### Cerrados en `bdece0f187e0f6d9dd480844c5942008d8391f8d`

- **H10:** el PR ahora contiene evidencia visual real y completa para C05, R02, R05, R06, 360 px, estados y reduced-motion; P04 legal ya no se presenta como referencia de forgot-password.
- **R04:** métricas paginadas hasta agotamiento sin techo global; accepted offers por chunks <=50. El test cubre 501 filas y 51 ofertas.
- **H20:** C02 filtra en DB `published|matched|in_transit` antes de paginar y la vista excluye terminales defensivamente.

### Sigue parcial

- **H09:** se cerró el hueco de template literals directos, pero no la clase completa de navegación indirecta.

## Probe independiente H09

Con las regex actuales de `assertNoInvalidInternalLinks`:

~~~text
<Link href="/ghost">x</Link>                    => true
<Link href={`/ghost/${id}`}>x</Link>          => true
const navItems=[{ href: '/ghost' }]              => false
<Link href={buildNextCursorHref(cursor)}>Next</Link> => false
return `/ghost?cursor=${cursor.id}`;           => false
router.push(targetUrl);                          => false
~~~

Casos reales afectados:
- `merchant-nav.tsx` y `courier-nav.tsx`: destinos viven en propiedades `href:`.
- `MerchantHistoryView`: el link de siguiente página usa `buildNextCursorHref(nextCursor)`.
- formularios auth usan `router.push(targetUrl)` / `router.push(result.data.redirectTo)`.

Algunos de estos caminos tienen tests funcionales propios, pero el DoD declara que `route-integrity` detecta **cualquier ruta interna inexistente**; hoy una ruta nueva/extra inválida puede escapar sin romper esas aserciones.

## CI

No inspeccionado: persiste H09.
