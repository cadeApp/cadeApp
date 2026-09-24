# Ronda 3 — PR #87 (T-118) — Revisión independiente

- **SHA revisado:** `6c321d01ad717bddc691a46c921303e092914d39`
- **develop:** `b6bdac6cfe4c5ac9227e87692b8572e1f6bc2121`
- **Fecha:** 2026-09-24
- **Comparación con R2:** 2 commits después de `6ba497a`; 24 archivos tocados por el arreglo; `docs/revision-pr/pr-87/**` permaneció intacto.
- **GitHub:** PR mergeable al iniciar/cerrar la inspección.
- **CI:** no abierto porque persisten bloqueantes.
- **Checks locales del proyecto:** no ejecutables en este runtime sin checkout del repo. Sí se ejecutaron probes independientes de JavaScript para fecha civil/TZ.

## Informe formato revisar-pr

~~~text
Informe revisar-pr — T-118 — 2026-09-24 — generado por revisión independiente
Resultado: CON BLOQUEANTES (8)
Checks locales: typecheck ⚪ no ejecutado · lint ⚪ no ejecutado · test ⚪ no ejecutado · test:db n.a.
BLOQUEANTES:
- [src/features/auth/guards.ts:84-121,273-274] (PR87-H01) residual: resolvePostLoginRedirect acepta cualquier ruta interna que evaluateRouteGuard deje caer al allow final; además isPublicRoute conserva /terms,/privacy,/pilot-terms,/legal sin páginas → /ruta-inexistente o /terms pueden terminar como redirect post-login a 404.
- [src/app/route-integrity.test.ts:85-99,211-264] (PR87-H09) el control de rutas sigue siendo una blacklist de cuatro strings; mutar a href="/ruta-inexistente" o redirectTo:"/ghost" queda fuera del control y no detecta el residual real de H01.
- [PR #87 body/comments] (PR87-H10) el PR no adjunta ninguna imagen: 0 Markdown images, 0 <img>, 0 github user-attachments y 0 URLs de imagen; la tabla textual de browser no sustituye el side-by-side 390 + control 360 del DoD.
- [src/features/merchants/copy.ts:49-54; queries.test.ts:76-100] (PR87-H16) paid_until es una fecha civil PostgreSQL date (YYYY-MM-DD), pero C08 la parsea con new Date(); en TZ America/Argentina/Buenos_Aires 2026-12-31 se muestra 30 de diciembre. El test usa un timestamp que la DB no devuelve.
- [src/features/requests/queries.ts:231-255; merchant-history-view.tsx:61-65] (PR87-H17) C07 con status=all no aplica ningún filtro y puede mezclar published/matched/in_transit con el historial terminal; el README vinculante define Todas/Entregadas/Canceladas/Vencidas y la UI dice finalizadas.
- [src/features/requests/queries.ts:231-245,278-295; merchant-history-view.tsx:188-209] (PR87-H18) las filas C07 siguen sin cadete ni monto aceptado, dos datos obligatorios del README Stitch vinculante.
- [src/features/requests/queries.ts:358-361,369-380] (PR87-R03) R02 se arregló trayendo todas las filas del comercio en metricsQuery sin limit/cursor; viola la regla de listas paginadas y escala con todo el historial.
- [src/features/requests/queries.ts:382-402] (PR87-H19) C02 llama “métricas del día”, pero todayStart usa el TZ del proceso y avgRateArs junta accepted_offer_id de toda la historia; en runtime UTC el día civil de Aguilares queda cortado incorrectamente.
MEJORAS:
- ninguna; cerrar primero los ocho bloqueantes.
No revisado / dudas para Lautaro073:
- ninguna decisión de alcance pendiente. A01/A02 continúan aceptadas por decisión explícita de P1.
- CI no se inspeccionó por regla mientras haya bloqueantes.
~~~

## Revalidación de R2

**Arreglados-verificados en este SHA:** H02, H03, H04, H05 (defecto original), H06, H07, H11, H12, R01, R02 (defecto original), H13, H14 y H15.

**Siguen abiertos/parciales:** H01, H09, H10.

**Nuevos en R3:** H16, H17, H18, R03, H19.

### Qué sí quedó bien

- C08 deriva el enum real `merchant_subscription_status` y propaga errores DB.
- R08 deriva `document_review_status`, combina DNI correctamente y propaga errores.
- C07 aplica el filtro específico antes de paginar, usa searchParams/Zod y cursor created_at+id.
- C02 ya no usa columnas inexistentes ni tarifa `$0` inventada.
- El body real volvió a la plantilla oficial y documenta las excepciones de alcance autorizadas.
- El agente no escribió la carpeta de revisión.

## Probes independientes

### paid_until civil

~~~text
TZ=America/Argentina/Buenos_Aires
new Date('2026-12-31').toLocaleDateString('es-AR')
=> 30 de diciembre de 2026
~~~

La RPC de T-105 recibe `p_paid_until date` y devuelve `YYYY-MM-DD`, por lo que ese input es la forma real.

### día de Aguilares vs runtime UTC

~~~text
instant: 2026-09-25T01:30:00.000Z
America/Argentina/Buenos_Aires: 2026-09-24 22:30
todayStart actual con proceso UTC: 2026-09-25T00:00:00.000Z
~~~

El corte actual puede excluir casi todo el 24/09 mientras para Aguilares todavía es 24/09.

## CI

No inspeccionado: persisten bloqueantes, por la regla de revisión vigente.
