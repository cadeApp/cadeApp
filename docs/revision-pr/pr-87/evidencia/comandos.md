# Comandos reproducibles — PR #87 · ronda 1

SHA revisado: 027f39e0ca5f010710142abc9d6ec5e189684ecf.

> Este entorno revisó por GitHub API y no tuvo checkout ejecutable ni DNS git. Los comandos quedan como harness para la siguiente sesión; no se afirma haber ejecutado pnpm. La batería equivalente de lectura/mutación en memoria sí se ejecutó contra el árbol remoto.

## Arranque

~~~bash
git fetch origin
test "$(git rev-parse HEAD)" = "027f39e0ca5f010710142abc9d6ec5e189684ecf"
git diff --stat origin/develop...HEAD
git diff origin/develop -- docs/tasks/T-118.md
git log --oneline -- docs/revision-pr/pr-87/
git merge-tree --write-tree origin/develop HEAD
~~~

Resultado remoto equivalente:
- HEAD 027f39e; develop b6bdac6.
- rama 3 delante / 2 detrás, mergeable.
- carpeta pr-87 sin commits previos.
- ficha del PR solo cambia checks; develop añadió la directiva visual.

## M01 — mutación del control R08

Guardar esto como /tmp/pr87-m01.mjs y ejecutarlo desde la raíz del repo:

~~~js
import fs from 'node:fs';

const page = fs.readFileSync('src/app/(courier)/courier/profile/page.tsx', 'utf8');
const leaf = fs.readFileSync('src/features/courier-onboarding/components/courier-profile-view.tsx', 'utf8');
const banned = /CBU|CVU|alias bancario/i;

const authorControl = (p) => !banned.test(p);
const closureControl = (p, l) => !banned.test(p + '\n' + l);

console.log('baseline autor', authorControl(page) ? 'GREEN' : 'RED');
console.log('baseline cierre', closureControl(page, leaf) ? 'GREEN' : 'RED');

const mutatedLeaf = leaf + '\n<div>CBU</div>\n';
console.log('mutación autor', authorControl(page) ? 'GREEN' : 'RED');
console.log('mutación cierre', closureControl(page, mutatedLeaf) ? 'GREEN' : 'RED');
~~~

Resultado obtenido por la batería remota:
~~~text
baseline autor GREEN
baseline cierre GREEN
mutación autor GREEN
mutación cierre RED
~~~

## H01 — destinos inexistentes

~~~bash
git grep -nE "(/admin|/terms|/privacy)" -- src/features/auth/guards.ts src/app/page.tsx src/features/auth/components/register-form.tsx 'src/app/(merchant)/merchant/plan/page.tsx' src/features/courier-onboarding/components/courier-profile-view.tsx
find src/app -type f -name page.tsx | sort | grep -E '/(admin|terms|privacy)/page\.tsx$' || true
git grep -n 'getRoleDefaultPath("admin")' -- src/app/route-integrity.test.ts || true
~~~

Resultado remoto: no hay páginas /admin, /terms ni /privacy; el test no menciona el default de admin.

## H02/H03/H04 — datos fantasma

~~~bash
git grep -nE "Piloto activo|piloto gratis" -- 'src/app/(merchant)/merchant/plan/page.tsx'
git grep -nE "\|\| 'moto'|\|\| 'approved'|Aprobado|Verificad" -- 'src/app/(courier)/courier/profile/page.tsx' src/features/courier-onboarding/components/courier-profile-view.tsx
git grep -nE "return '1,0'|\?\? 'Centro'|\?\? 'Aguilares'" -- src/features/requests/queries.ts
~~~

Todos producen matches en 027f39e.

## H05 — historial sin paginación

~~~bash
sed -n '130,160p' src/features/requests/queries.ts
git grep -nE "\.(limit|range)\(" -- src/features/requests/queries.ts
~~~

getMerchantRequests ordena por created_at y no aplica limit/range/cursor.

## H06 — boundaries

~~~bash
find src/app -type f \( -name loading.tsx -o -name error.tsx \) | sort
~~~

En 027f39e solo aparecen:
~~~text
src/app/(merchant)/requests/[id]/loading.tsx
src/app/(merchant)/requests/loading.tsx
src/app/(merchant)/requests/new/loading.tsx
~~~

Los ocho segmentos canónicos con datos auditados no tienen loading.tsx ni error.tsx.

## H07 — tipografía y targets

~~~bash
git grep -n '\btext-xs\b' -- 'src/app/(merchant)/layout.tsx' 'src/app/(merchant)/merchant/plan/page.tsx' src/features/courier-onboarding/components/courier-profile-view.tsx src/features/requests/components/merchant-history-view.tsx
git grep -nE 'h-7 w-12|min-h-10' -- src/features/courier-onboarding/components/courier-profile-view.tsx src/features/requests/components/merchant-history-view.tsx
~~~

Resultado remoto: 15 text-xs, 1 switch h-7 w-12, 4 tabs min-h-10.

## H08 — CSS/valores arbitrarios

~~~bash
git grep -nE '<style>|#[0-9A-Fa-f]{6}|text-\[#[0-9A-Fa-f]{6}\]' -- 'src/app/(merchant)/layout.tsx' 'src/app/(courier)/layout.tsx' 'src/app/(merchant)/merchant/plan/page.tsx'
~~~

Resultado: dos style locales con hex/important y text-[#25D366].

## H10/H11 — evidencia y cuerpo

~~~bash
gh pr view 87 --json body,comments
~~~

Resultado leído por API: 0 comentarios, sin capturas y faltan Qué cambia, DoD, Evidencia de checks, Informe de revisión de agy y Rollback.

## H12 — SHA de bitácora

~~~bash
git cat-file -e '4d30851^{commit}'
~~~

Equivalente remoto: GitHub devuelve 422 No commit found.

## Rojo del autor

El commit da34d186 existe. En su árbol faltan 14/16 archivos de requiredFiles, P01 conserva el placeholder T-000 y registerAction todavía no contiene los dos destinos nuevos de onboarding. No se atribuye el contador exacto de Vitest sin runner.

## Batería completa para la próxima ronda

~~~bash
node /tmp/pr87-m01.mjs
pnpm typecheck > /tmp/pr87-typecheck.log 2>&1
pnpm lint > /tmp/pr87-lint.log 2>&1
pnpm test > /tmp/pr87-test.log 2>&1
pnpm build > /tmp/pr87-build.log 2>&1
tail -n 40 /tmp/pr87-typecheck.log
tail -n 40 /tmp/pr87-lint.log
tail -n 80 /tmp/pr87-test.log
tail -n 60 /tmp/pr87-build.log
~~~

CI se abre recién cuando la ronda quede sin bloqueantes.


---

# Ronda 2 — evidencia sobre 225cd08

## Alcance

~~~bash
git diff --name-only origin/develop...HEAD
# Contrastar con "Archivos permitidos" de docs/tasks/T-118.md.
~~~

Resultado de la revisión remota:
~~~text
FUERA DE FICHA:
src/features/requests/index.ts
src/ui/brand-logo.tsx
src/ui/button.tsx
src/ui/top-bar.tsx
src/ui/ui-system.test.tsx
~~~

Los cuatro \`src/ui/**\` son A01. \`requests/index.ts\` queda como A02 decisión porque la arquitectura prohíbe deep imports.

## H01/H07/H09 — hueco del control

~~~bash
grep -nE 'href="/(terms|privacy)"|text-xs' 'src/app/(public)/layout.tsx'
grep -n "src/app/(public)/layout.tsx" src/app/route-integrity.test.ts
~~~

Resultado:
~~~text
public/layout: /terms x2, /privacy x1, text-xs x1
route-integrity: sólo lo enumera como archivo requerido; no está en auditedFiles/auditedViews.
~~~

Además:
~~~bash
grep -nE "redirectTo: '/admin'|redirectTo: \`/admin/mfa" src/features/auth/guards.ts
~~~

## H02 — enum de suscripción

~~~bash
grep -n "merchant_subscription_status" src/types/database.types.ts
grep -nE "subscriptionStatus:|'trial'|'grace_period'|'suspended'" src/features/merchants/queries.ts
grep -n "default 'pilot'" supabase/migrations/20260922031435_schema_v1.sql
~~~

Contrato: \`pilot|active|expired|cancelled\`; código: \`trial|active|grace_period|suspended\`.

Mutación/prueba que debe existir:
~~~text
DB devuelve pilot -> C08 renderiza estado piloto sin excepción.
DB devuelve expired/cancelled -> render consistente.
Cambiar pilot por trial en mapper -> test rojo.
~~~

## H03 — enum documental

~~~bash
grep -n "document_review_status" src/types/database.types.ts
grep -nE "pending|approved|valid|verified|submitted" \
  'src/app/(courier)/courier/profile/page.tsx' \
  src/features/courier-onboarding/components/courier-profile-view.tsx
~~~

Contrato: \`none|submitted|verified|rejected\`; la UI no tiene cases \`submitted/verified\`.

## H06 — error boundaries físicamente presentes pero inalcanzables

~~~bash
grep -n "if (error || !rawRequests.length)" src/features/requests/queries.ts
grep -n "if (merchantError || !merchant)" src/features/merchants/queries.ts
grep -nE "profileResult.error|courierResult.error|docsResult.error" 'src/app/(courier)/courier/profile/page.tsx' || true
~~~

Un error DB se transforma en vacío/null o se ignora; no llega a \`error.tsx\`.

## R01/R02/H13 — paginación

~~~bash
grep -nE "useState<FilterTab>|filteredRequests.length === 0|nextCursor" src/features/requests/components/merchant-history-view.tsx
grep -nE "searchParams|cursorCreatedAt|cursorId" 'src/app/(merchant)/merchant/history/page.tsx'
grep -nE "limit\\(pageSize \\+ 1\\)|avgRateArs: 0|query = query.or" src/features/requests/queries.ts
grep -n "getMerchantRequests" src/features/requests/queries.test.ts || true
~~~

Resultado: no hay test de getMerchantRequests/51 filas; filtro cliente ocurre después del slice; cursor no se valida; métricas compartidas usan la página y tarifa=0.

## H14 — columnas C02

~~~bash
grep -nE "select\\('id, name'\\)|merchantProfile.id" 'src/app/(merchant)/merchant/dashboard/page.tsx'
grep -nE "profile_id:|business_name:" src/types/database.types.ts
~~~

\`merchants\` no tiene \`id\` ni \`name\`.

## H15 — variante inexistente

~~~bash
grep -n "variant: 'primary'" \
  'src/app/(merchant)/merchant/plan/page.tsx' \
  src/features/courier-onboarding/components/courier-profile-view.tsx
sed -n '8,18p' src/ui/button.tsx
~~~

\`primary\` no está entre las variantes de Button.

## H10/H11 — PR real

~~~bash
gh pr view 87 --json body,comments
~~~

Resultado de la revisión remota:
- sin capturas;
- body real no tiene \`### Qué cambia\`, \`### DoD\`, \`### Evidencia de checks\`, \`### Informe de revisión de agy\` ni \`### Rollback\`;
- conserva “400 tests” y “sin modificaciones src/ui”, ambos desactualizados/contradichos por el head.

## Batería exigida para siguiente ronda

~~~bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
# + pruebas de mutación específicas descritas en ronda-2.md
~~~

No abrir CI como evidencia de cierre hasta eliminar estos bloqueantes.


## Corrección de alcance de R2 por decisión de P1

Lautaro/P1 confirmó después de la primera publicación de R2 que él había autorizado expresamente durante la implementación:

~~~text
src/ui/brand-logo.tsx
src/ui/button.tsx
src/ui/top-bar.tsx
src/ui/ui-system.test.tsx
src/features/requests/index.ts   # barrel de MerchantHistoryView
~~~

Por tanto estos archivos **no se usan como evidencia de desvío del agente**. A01/A02 pasan a `aceptado`; H08 queda cerrado porque los estilos locales/hex originales sí fueron eliminados.

La siguiente ronda debe comprobar que la autorización quedó documentada como excepción explícita en ficha/bitácora/body, sin ampliar el resto del scope.


---

# Ronda 3 — evidencia sobre 6c321d01ad717bddc691a46c921303e092914d39

## Estado remoto y alcance del arreglo

~~~text
R2 review head: 6ba497ab2c7e3376b2be6b6cf27a2498b9dbbef2
R3 implementation head: 6c321d01ad717bddc691a46c921303e092914d39
compare: ahead 2 / behind 0
agent changes after R2: 24 files
docs/revision-pr/pr-87/** touched by agent: NO
PR mergeable: true
~~~

## H01 / H09 — destino interno arbitrario sigue sin control

`src/features/auth/guards.ts` conserva:

~~~text
publicPrefixes = ['/terms', '/privacy', '/pilot-terms', '/forgot-password', '/legal']
...
if (guardResult.action === 'allow') return rawRedirectTo
...
// resto
return { action: 'allow' }
~~~

El árbol real de `src/app/(public)` sólo contiene `forgot-password`, `login`, `register` y `layout.tsx`.

El helper de `route-integrity.test.ts` sólo prohíbe:

~~~text
href="/terms"
href="/privacy"
href="/admin"
href="/admin/mfa"
redirectTo: /admin o /admin/mfa
~~~

Mutación mínima que el control actual debe matar y hoy no representa:

~~~text
<Link href="/ruta-inexistente">X</Link>
return { action: 'redirect', redirectTo: '/ghost' }
resolvePostLoginRedirect('/ruta-inexistente', 'merchant')
~~~

## H10 — adjuntos visuales

Lectura API de body + todos los comentarios del PR:

~~~text
markdownImages: 0
htmlImages: 0
github user-attachments: 0
image URLs (png/jpeg/webp/gif): 0
comments total: 2
~~~

La tabla textual de “Evidencia visual” no es el side-by-side adjunto requerido.

## H16 — paid_until es fecha civil

Contrato real de T-105:

~~~sql
admin_set_subscription(... p_paid_until date default null ...)
...
'paidUntil', to_char(p_paid_until, 'YYYY-MM-DD')
~~~

Probe independiente:

~~~bash
TZ=America/Argentina/Buenos_Aires node -e "const d=new Date('2026-12-31'); console.log(d.toLocaleDateString('es-AR',{day:'2-digit',month:'long',year:'numeric'}))"
~~~

Salida:

~~~text
30 de diciembre de 2026
~~~

El test del autor usa `paid_until: '2026-12-31T23:59:59Z'`, que no es la forma real del `date`.

## H17 / H18 — C07

README vinculante C07:

~~~text
Tabs: Todas, Entregadas, Canceladas, Vencidas
Datos clave: Ruta, cadete, monto, hora y badge
~~~

Código actual:
- con `status=all`, no aplica filtro de estado;
- la fila muestra ruta, distancia, paquete, hora y badge;
- no carga ni muestra cadete/monto de la oferta aceptada.

Pruebas actuales de 51 filas usan sólo `delivered`, por lo que no detectan activas en “Todas”.

## R03 / H19 — métricas C02

Código actual:

~~~text
metricsQuery = delivery_requests.select(...).eq(merchant_id)   # sin limit/cursor
todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
acceptedOfferIds += todas las filas con accepted_offer_id
~~~

Probe del corte de día con proceso UTC:

~~~text
instant: 2026-09-25T01:30:00.000Z
America/Argentina/Buenos_Aires: 2026-09-24 22:30
todayStart actual: 2026-09-25T00:00:00.000Z
~~~

El README C02 llama a `Despachos hoy` y `Tarifa promedio` “Métricas del día”; la tarifa actual promedia todas las ofertas aceptadas históricas.

## Revalidaciones cerradas en R3

Por inspección del SHA exacto quedaron cerrados: H02, H03, H04, H05, H06, H07, H11, H12, R01, R02, H13, H14, H15.

No se inspeccionó CI porque quedan bloqueantes.


---

# Ronda 4 — evidencia sobre cf6fa22299b4df28982b0babb0ba7bc0aa146526

## Estado remoto

~~~text
R3 review head: 81d595db2536e99f1a5ecf33762d306eab5afb0c
R4 implementation head: cf6fa22299b4df28982b0babb0ba7bc0aa146526
compare: ahead 1 / behind 0
agent changes after R3: 11 files
docs/revision-pr/pr-87/** touched by agent: NO
PR mergeable: true
~~~

## H09 — el scanner no reconoce template literals

Regex actuales en `assertNoInvalidInternalLinks`:

~~~text
href="..."
redirectTo: "..."
redirect("...")
router.push("...") / replace("...")
~~~

Probe con las mismas regex:

~~~text
<Link href={`/ghost/${id}`}>x</Link> => false
router.push(`/ghost/${id}`) => false
return { redirectTo: '/ghost' } => true
~~~

El árbol real usa `href={`/merchant/requests/${req.id}`}` en `merchant-history-view.tsx`.

## H10 — matriz visual

Commit de evidencia: `bc27f5eea7fbdeb07b224d9b908b1259e8c51a2a` (23 PNG).

Faltantes/errores al contrastar con README vinculante:
- C05 existe en C00, pero no hay captura/fila C05 de implementación.
- R02 existe en R00, pero la fila R01/R02 sólo usa referencia R01 + implementación R01.
- R05 existe en R00, pero no hay captura/fila R05.
- P04 en P00 es “Términos y Privacidad”; el body usa `P04-documento-legal.png` como referencia de `/forgot-password`.
- no hay evidencia específica de reduced-motion.

## R04 — topes silenciosos de métricas

Código:

~~~text
MAX_METRICS_BATCHES = 10
METRICS_BATCH_LIMIT = 50
todayAcceptedOfferIds.slice(0, 50)
~~~

Probe:

~~~text
51 ofertas: promedio correcto 1176; promedio truncado 1000
501 solicitudes: 500 alcanzables; 1 omitida
~~~

La prueba del autor sólo afirma que no existe una query sin `.limit`, no que el total siga siendo exacto.

## H20 — C02 mezcla terminales

~~~text
getMerchantRequests:
  status default = all
  if status !== all -> eq(status)
  else -> sin filtro

MerchantDashboardPage:
  getMerchantRequests(profile_id)   # sin status

MerchantRequestsList:
  requests.map(...)
  EmptyState: "No tenés solicitudes activas"
~~~

La referencia C02 exige “Lista de solicitudes activas”. Falta filtrar `published|matched|in_transit` en DB antes del límite.

## CI

No inspeccionado por existir 4 bloqueantes.
