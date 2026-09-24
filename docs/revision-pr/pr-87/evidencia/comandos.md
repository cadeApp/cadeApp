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
