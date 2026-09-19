# cadeApp — Plan de implementación para agentes (agy)

> Complementa el [master plan](master-plan.md): acá está el **cómo**, con 3 personas programando con agy.
> Este documento se pidió en el checkpoint y **no pasó por la revisión del Consejo**. Conviene validarlo con `$el-consejo revisar` antes de la Fase 1.
> Las rutas de reglas y skills salen de la documentación integrada de agy 1.2.4 (`agy-customizations`): `AGENTS.md` por carpeta, `.agents/rules/*.md`, `.agents/skills/<nombre>/SKILL.md` y `.agents/hooks.json`.

---

## 1. Principios de trabajo con agentes

1. **Primero los contratos, después el código.** Esquema de base, tipos generados, schemas Zod, firmas de RPC y códigos de error se congelan al terminar la Fase 0. Tres agentes en paralelo solo funcionan si nadie inventa su propia versión de un contrato.
2. **Una tarea = una rama = un PR = un dueño.** Cada tarea declara los archivos que puede tocar. El agente no edita nada fuera de esa lista; si lo necesita, se detiene y pide una tarea de cambio de contrato.
3. **Tareas chicas y verificables.** Apuntar a PRs de hasta unas 400 líneas netas, con definición de hecho (DoD) y pruebas propias.
4. **Módulos con fronteras duras.** Cada feature expone lo público por `index.ts`. Los imports profundos entre features los bloquea ESLint.
5. **La base es la autoridad.** Las reglas críticas (estados, piso, aceptación, autorización) viven en RPC de Postgres y RLS. La UI nunca es la única barrera.
6. **Nada se da por verificado sin evidencia.** El agente adjunta al PR la salida de `typecheck`, `lint` y pruebas. Si no pudo correr algo, lo dice.

## 2. Equipo y responsabilidades

| Pista | Persona | Es dueña de | Carpetas |
|---|---|---|---|
| **P1 · Datos y dominio de servidor** | Persona 1 | Supabase, migraciones, RLS, RPC, cron, emisor de push, backups, observabilidad | `supabase/**`, `src/server/**`, `src/app/api/**`, `docs/adr/**` |
| **P2 · App de comercio y repartidor** | Persona 2 | Dominio puro, UI de comercio y repartidor, tiempo real, accesibilidad | `src/domain/**`, `src/features/{merchants,requests,offers,trips,availability}/**`, `src/app/(merchant)/**`, `src/app/(courier)/**`, `src/ui/**` |
| **P3 · Admin, PWA y plataforma** | Persona 3 | Scaffold, reglas de agy, CI/CD, onboarding de repartidores, panel admin, PWA, cliente de push, E2E | `.agents/**`, `AGENTS.md`, `.github/**`, `src/features/{courier-onboarding,admin,incidents,notifications,legal}/**`, `src/app/(admin)/**`, `src/app/(public)/**`, `public/**`, `e2e/**` |

Solo P1 mergea migraciones y regenera `src/types/database.types.ts`. Si P2 o P3 necesitan un cambio de esquema, abren una tarea `contract-change` asignada a P1.

## 3. Estructura del repositorio

```text
cadeapp/
├─ AGENTS.md                      # reglas raíz (siempre activas)
├─ .agents/
│  ├─ rules/                      # reglas temáticas (§4)
│  └─ skills/                     # procedimientos (§5)
├─ .github/
│  ├─ workflows/ci.yml            # typecheck, lint, unit, db-tests, build, types-diff
│  ├─ workflows/migrate.yml       # aplica migraciones al mergear en develop/staging/main
│  ├─ workflows/e2e-staging.yml   # suite E2E completa contra staging
│  ├─ CODEOWNERS
│  └─ pull_request_template.md
├─ docs/
│  ├─ master-plan.md
│  ├─ implementation-plan.md
│  ├─ adr/0001-supabase.md, 0002-hosting-y-cron.md
│  └─ tasks/T-xxx.md              # una ficha por tarea (§8)
├─ supabase/
│  ├─ AGENTS.md                   # reglas de migraciones y RLS
│  ├─ config.toml
│  ├─ migrations/                 # timestamped, inmutables una vez mergeadas
│  ├─ seed.sql                    # zonas de Aguilares, settings, usuarios de prueba (solo local/staging)
│  └─ tests/                      # pgTAP: rls_*.sql, rpc_*.sql
├─ src/
│  ├─ app/
│  │  ├─ (public)/                # landing, login, términos, privacidad
│  │  ├─ (merchant)/              # panel del comercio
│  │  ├─ (courier)/               # panel del repartidor
│  │  ├─ (admin)/                 # panel admin (requiere MFA)
│  │  └─ api/{cron,push,health}/  # route handlers
│  ├─ domain/                     # TS puro: estados, reglas, errores, contratos RPC
│  │  └─ AGENTS.md
│  ├─ features/<modulo>/
│  │  ├─ components/              # componentes de la feature
│  │  ├─ actions.ts               # server actions ("use server")
│  │  ├─ queries.ts               # lecturas server-side
│  │  ├─ schemas.ts               # Zod de formularios
│  │  └─ index.ts                 # API pública del módulo
│  ├─ server/                     # clientes Supabase, wrappers de RPC, auditoría, push emitter
│  ├─ lib/                        # utilidades sin estado (whatsapp link, compresión, formato ARS)
│  ├─ ui/                         # tokens semánticos y primitivas accesibles
│  └─ types/database.types.ts     # GENERADO, no editar a mano
├─ e2e/
│  ├─ AGENTS.md
│  ├─ fixtures/ pages/ specs/     # un spec por flujo
└─ package.json                   # pnpm, versiones fijadas
```

**Módulos de `src/features`:** `auth`, `merchants`, `requests`, `offers`, `trips`, `availability`, `courier-onboarding`, `admin`, `incidents`, `notifications`, `legal`.

**Reglas de dependencia** (hechas cumplir con ESLint `no-restricted-imports` o `eslint-plugin-boundaries`):
- `domain` no importa nada del proyecto.
- `lib` y `ui` pueden importar `domain`.
- `server` puede importar `domain`, `lib` y `types`.
- `features/x` puede importar `domain`, `lib`, `ui`, `server` (solo desde server actions y queries) y **`features/y/index.ts`**, nunca archivos internos de otra feature.
- `app` importa de `features/*/index.ts`, `ui` y `lib`.
- El código de cliente (`"use client"`) nunca importa `server/**`.

## 4. Reglas para agy (contenido para commitear en T-001)

### 4.1 `AGENTS.md` (raíz)

```markdown
# cadeApp — reglas raíz para agentes

cadeApp es una PWA (Next.js + TypeScript strict + Supabase) que conecta comercios de Aguilares con
repartidores independientes. Fuente de verdad: docs/master-plan.md. Cómo trabajar: docs/implementation-plan.md.

## Antes de escribir código
1. Leé la ficha de tu tarea en docs/tasks/T-xxx.md. Si no hay ficha, no empieces: pedila.
2. Tocá SOLO los archivos de "Archivos permitidos". Si necesitás otro, detenete y explicá por qué.
3. Leé los contratos: src/domain/**, src/types/database.types.ts y las RPC en supabase/migrations.
   No los cambies: un cambio de contrato es una tarea contract-change de P1.

## Invariantes que nunca se rompen
- Estados, piso de oferta, aceptación y autorización se validan en RPC de Postgres. La UI solo refleja.
- Nunca hardcodear 1000: el piso sale de platform_settings.min_offer_ars. Montos: enteros en ARS.
- Datos del destinatario solo en delivery_request_contacts. Jamás en logs, push, analytics ni URLs.
- DNI/selfie: bucket privado courier-docs; lectura solo con URL firmada server-side para admin + audit_log.
- La service role key solo existe en src/server/admin-client.ts. Nunca en código "use client".
- Toda mutación crítica pasa por una RPC; no hacer update/insert directo de status u offers.
- El push es best-effort: nunca es la única forma de enterarse de algo.

## Calidad
- TypeScript strict: prohibido any, @ts-ignore, @ts-expect-error sin issue enlazado y non-null assertions (!).
- Validar con Zod toda entrada externa (formularios, params, route handlers).
- Cada tarea trae sus pruebas (ver .agents/rules/40-testing.md). Sin pruebas verdes no hay PR.
- Antes de abrir PR: pnpm typecheck && pnpm lint && pnpm test && pnpm test:db (si tocaste supabase/).

## Seguridad operativa del agente
- No leas ni imprimas .env*, claves ni tokens. No los pegues en commits, PRs ni logs.
- No corras comandos contra proyectos Supabase remotos (db push, db reset) ni despliegues: eso es CI.
- No uses git push --force, no pushees a develop/staging/main, no reescribas historia compartida.
- No agregues dependencias que no figuren en la ficha de la tarea.
- No modifiques AGENTS.md, .agents/**, .github/** ni migraciones ya mergeadas salvo que la tarea lo diga.

## Convenciones
- Código e identificadores en inglés; textos de UI en español rioplatense (es-AR); docs en español.
- Commits: Conventional Commits con id de tarea: feat(offers): submit offer form [T-114].
- Rama: feat/T-xxx-slug-corto desde develop actualizado.
```

### 4.2 `.agents/rules/`

**`10-typescript.md`**
```markdown
# TypeScript
- tsconfig: strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes, noImplicitOverride.
- Tipos de base: siempre desde src/types/database.types.ts (generado). No redefinir filas a mano.
- Errores de dominio: usar el union DomainErrorCode de src/domain/errors.ts; nunca strings sueltos.
- Resultados de acciones: type ActionResult<T> = { ok: true; data: T } | { ok: false; code: DomainErrorCode }.
- Nada de lógica de negocio en componentes: va en domain (puro) o en RPC (autoridad).
- Funciones puras en domain con tests unitarios; sin fechas implícitas (inyectar now).
```

**`20-arquitectura.md`**
```markdown
# Arquitectura y módulos
- Respetá las fronteras de docs/implementation-plan.md §3. ESLint las hace cumplir: no las desactives.
- Una feature expone solo lo que exporta su index.ts.
- Server actions en features/x/actions.ts con "use server"; validan con Zod, llaman a src/server/rpc.ts
  y devuelven ActionResult. Nunca devuelven filas con datos de contacto a quien no corresponde.
- Lecturas en features/x/queries.ts con el cliente server de @supabase/ssr (respeta RLS).
- Tiempo real: suscribirse en un hook de cliente + refetch en focus/visibilitychange/online.
- Route handlers de api/cron requieren header Authorization: Bearer ${CRON_SECRET}.
- Nuevos parámetros de negocio → platform_settings, no constantes en código.
```

**`30-supabase-seguridad.md`**
```markdown
# Supabase y seguridad
- RLS habilitada en TODAS las tablas. Política por rol explícita; default deny.
- Operaciones críticas = funciones SECURITY DEFINER con search_path fijo, chequeo de auth.uid() y rol,
  y errores con códigos estables (RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='OFFER_BELOW_MINIMUM').
- accept_offer: SELECT ... FOR UPDATE sobre la solicitud; idempotente; índice único parcial de accepted.
- Revalidar estado del repartidor (approved, no suspended) dentro de cada RPC que lo involucre.
- Expiración perezosa: toda consulta/RPC trata expires_at < now() como expirada.
- Admin: las RPC admin_* exigen aal2 (MFA) en el JWT.
- Documentos: bucket courier-docs privado; policies de storage: insert solo en courier/{auth.uid()}/**;
  select denegado a todos salvo service role. URLs firmadas de 60 s generadas en src/server + audit_log.
- Nunca loguear filas completas; nunca datos del destinatario ni documentos en Sentry.
```

**`40-testing.md`**
```markdown
# Pruebas (obligatorias por tarea)
- domain: Vitest, casos felices + bordes (ej. 999/1000/1001, transiciones inválidas por actor).
- RPC/RLS: pgTAP en supabase/tests contra Supabase local. Toda RPC nueva trae su test; toda tabla
  nueva trae su fila en la matriz RLS (rls_matrix.sql).
- Concurrencia: accept_offer se prueba con N llamadas en paralelo; exactamente una gana.
- UI: tests de componente solo para lógica no trivial; los flujos se cubren con Playwright.
- E2E: un spec por flujo en e2e/specs, usando fixtures de e2e/fixtures y page objects; nunca datos
  reales; cada spec limpia lo que crea.
- Prohibido: .only, .skip sin issue, sleeps fijos (usar expect.poll / waitFor), mocks de la base en
  tests de RPC.
- Una prueba que no puede fallar no verifica nada: al agregar una, rompé a propósito la regla y
  confirmá que falla antes de dejarla verde.
```

**`50-git-y-ambientes.md`**
```markdown
# Git y ambientes
- Ramas: feat/T-xxx-slug → PR a develop. Release: PR develop→staging, luego staging→main.
- develop, staging y main están protegidas: PR + 1 aprobación humana + checks verdes; sin push directo.
- Un PR = una tarea. Título: [T-xxx] descripción. Completá la plantilla con evidencia de checks.
- Rebase sobre develop antes de pedir review; resolvé conflictos solo en archivos de tu tarea.
- Migraciones: supabase migration new <nombre>; nunca editar una migración mergeada; corregir con otra.
- src/types/database.types.ts se regenera solo en PRs de migración (pnpm db:types) y el CI falla si difiere.
- Variables de entorno: documentar nuevas en .env.example; valores reales solo en GitHub Environments/hosting.
```

**`60-ui-accesibilidad.md`**
```markdown
# UI y accesibilidad
- Diseño visual pendiente: usar solo tokens semánticos de src/ui/tokens (no colores/medidas sueltos).
- WCAG 2.2 AA: contraste ≥ 4.5:1, foco visible, labels asociados, roles/aria correctos.
- Objetivos táctiles ≥ 48×48 px en acciones del repartidor (Ofertar, Aceptar, Contactar, Retirado, Entregado).
- Montos: input inputmode="numeric", mostrar piso vigente, formato ARS sin decimales.
- Acciones irreversibles (aceptar, cancelar, suspender): confirmación en dos pasos.
- Estados vacíos, de carga y de error siempre presentes; nunca pantallas en blanco.
- Textos en es-AR, directos; no prometer "verificado" si el admin no revisó el comprobante.
```

### 4.3 Reglas por carpeta

**`supabase/AGENTS.md`**
```markdown
# supabase/
- Solo P1 mergea acá. Cada migración: un propósito, reversible con otra migración, con test pgTAP.
- Orden en una migración: tipos/enums → tablas → índices → funciones → RLS/policies → grants.
- Toda función SECURITY DEFINER: SET search_path = public, pg_temp; REVOKE ALL FROM public; GRANT a authenticated.
- seed.sql jamás contiene datos reales; usuarios de prueba con emails @example.test.
```

**`src/domain/AGENTS.md`**
```markdown
# src/domain/
- TypeScript puro: prohibido importar next, react, @supabase, fetch o cualquier IO.
- Es el contrato compartido: cambios solo por tarea contract-change, con tests y aviso al equipo.
```

**`e2e/AGENTS.md`**
```markdown
# e2e/
- Corre contra staging (CI) o local con seed. Nunca contra producción.
- Selectores por rol/label accesible (getByRole, getByLabel), no por clases CSS.
- Cada spec crea sus propios usuarios/solicitudes vía fixtures y los limpia al terminar.
```

### 4.4 Hooks (opcional)

`.agents/hooks.json` permite correr comandos en eventos del agente, por ejemplo lint después de editar. Antes de configurarlo, verificá los nombres de eventos y de `matcher` en la documentación integrada (`agy-customizations/docs/hooks.md`). La garantía real la dan los checks del CI; el hook solo acelera el feedback.

## 5. Skills para agy (`.agents/skills/`)

**`tomar-tarea/SKILL.md`**
```markdown
---
name: tomar-tarea
description: >-
  Usar al empezar cualquier tarea T-xxx de cadeApp. Prepara la rama, lee contratos y fija el alcance.
---
# Tomar una tarea
1. Leer docs/tasks/T-xxx.md completo. Si falta "Archivos permitidos" o "DoD", detenerse y pedirlo.
2. Verificar que las dependencias de la ficha estén mergeadas en develop; si no, detenerse.
3. git switch develop && git pull && git switch -c feat/T-xxx-<slug>.
4. Leer los contratos listados en la ficha (domain, tipos generados, RPC).
5. Escribir primero las pruebas del DoD y confirmar que fallan.
6. Implementar tocando solo archivos permitidos.
7. Correr pnpm typecheck, pnpm lint, pnpm test y (si aplica) pnpm test:db; adjuntar salida.
8. Actualizar Estado en la ficha y abrir PR con la plantilla. No mergear.
```

**`nueva-migracion/SKILL.md`**
```markdown
---
name: nueva-migracion
description: >-
  Usar cuando una tarea de P1 requiere cambiar el esquema, RLS o funciones de Supabase.
---
# Nueva migración
1. pnpm supabase migration new <nombre_en_snake_case>.
2. Escribir SQL siguiendo supabase/AGENTS.md (orden, search_path, grants, RLS default deny).
3. Agregar/actualizar tests en supabase/tests (matriz RLS y RPC).
4. pnpm supabase db reset (solo local) && pnpm test:db.
5. pnpm db:types y commitear src/types/database.types.ts en el mismo PR.
6. Si cambia un contrato usado por P2/P3, listar el impacto en el PR y avisar.
```

**`nueva-rpc/SKILL.md`**
```markdown
---
name: nueva-rpc
description: >-
  Usar para crear o modificar una función RPC crítica (estados, ofertas, admin) de cadeApp.
---
# Nueva RPC
1. Confirmar firma y códigos de error en src/domain/rpc-contracts.ts (si no existen, es contract-change).
2. Implementar como SECURITY DEFINER con chequeo de auth.uid(), rol, estado y expiración perezosa.
3. Revalidar precondiciones dentro de la transacción; bloquear filas que compiten (FOR UPDATE).
4. Tests pgTAP: caso feliz, cada código de error, actor incorrecto, estado incorrecto, concurrencia si aplica.
5. Wrapper tipado en src/server/rpc.ts que mapea errores a DomainErrorCode.
```

**`nuevo-e2e/SKILL.md`**
```markdown
---
name: nuevo-e2e
description: >-
  Usar para escribir un spec de Playwright de un flujo de cadeApp.
---
# Nuevo E2E
1. Un archivo por flujo: e2e/specs/<flujo>.spec.ts; reutilizar fixtures y page objects.
2. Crear datos vía fixtures (API/SQL de staging seed), nunca por UI salvo que sea el flujo probado.
3. Selectores accesibles; esperas con expect/poll; sin timeouts fijos.
4. Cubrir camino feliz + los bordes que lista la ficha; incluir chequeo axe en pantallas clave.
5. Verificar que el spec falla si se rompe la regla (p. ej. comentando la validación) antes de dejarlo verde.
```

## 6. Git, CI/CD y ambientes (resumen operativo)

- **Ramas:** `main` (producción), `staging`, `develop` y `feat/T-xxx-*`. Hotfix: `fix/T-xxx-*` desde `main` y back-merge a `staging` y `develop`.
- **Protecciones:** PR obligatorio, 1 aprobación de otra persona, checks `ci` verdes y rama al día. En `main` se suma el check `e2e-staging`.
- **`CODEOWNERS`:** `supabase/`, `src/server/` y `src/app/api/` → P1; `src/domain/`, `src/features/{merchants,requests,offers,trips,availability}/`, `src/app/(merchant|courier)/` y `src/ui/` → P2; `.agents/`, `AGENTS.md`, `.github/`, `e2e/`, `public/`, `src/features/{courier-onboarding,admin,incidents,notifications,legal}/` y `src/app/(admin|public)/` → P3.
- **CI (`ci.yml`):** `pnpm install --frozen-lockfile` → `typecheck` → `lint` → `test` → `supabase start` + `test:db` → `db:types` sin diff → `build`.
- **`migrate.yml`:** al mergear, aplica `supabase db push` al proyecto del ambiente, con el token guardado en GitHub Environments (`develop`, `staging`, `production`). En `production` exige aprobación manual del environment.
- **`e2e-staging.yml`:** después del deploy en staging, corre la suite completa y publica el reporte como artefacto.
- **Deploy de la app:** cada rama con su ambiente en el hosting (S1 del master plan). Variables por ambiente: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `DNI_HMAC_SECRET` y `SENTRY_DSN`.

## 7. Fases y tareas

Leyenda: **Dep** = tareas que tienen que estar mergeadas antes. Las tareas de una misma fase y distinta pista corren en paralelo.

### Fase 0 — Fundaciones y contratos

| ID | Pista | Tarea | Dep | Archivos permitidos | DoD / pruebas |
|---|---|---|---|---|---|
| T-000 | P3 | Scaffold: Next.js App Router con pnpm y TS strict (§4.2), ESLint con fronteras, Prettier, Vitest, Playwright, estructura de carpetas vacía con `index.ts` | — | raíz, `src/**` (esqueleto), configs | `pnpm typecheck`, `lint`, `test` y `build` verdes; un import prohibido de prueba hace fallar lint |
| T-001 | P3 | Reglas y skills de agy (§4 y §5), plantilla de ficha y de PR, `CODEOWNERS` | T-000 | `AGENTS.md`, `.agents/**`, `docs/tasks/_plantilla.md`, `.github/pull_request_template.md`, `.github/CODEOWNERS` | agy carga las reglas (verificar abriendo una sesión en `supabase/` y preguntando por sus reglas) |
| T-002 | P1 | Supabase CLI local, `config.toml`, tres proyectos cloud (develop, staging, prod), `.env.example` y scripts `db:*` | T-000 | `supabase/config.toml`, `package.json` (scripts), `.env.example`, `docs/adr/0002-hosting-y-cron.md` (borrador) | `supabase start` y `db reset` locales OK; proyectos creados y documentados, sin claves en el repo |
| T-003 | P3 | CI (`ci.yml`, `migrate.yml`), GitHub Environments, protección de ramas y ambientes en el hosting | T-000, T-002 | `.github/workflows/**` | Un PR con error de tipos queda bloqueado; merge a develop dispara la migración (con una migración vacía de prueba) |
| T-004 | P1 | Esquema v1 completo (§7 del master plan): enums, tablas, índices únicos parciales, triggers de `profiles`, seed de `zones` y `platform_settings`, tipos generados | T-002 | `supabase/migrations/**`, `supabase/seed.sql`, `src/types/database.types.ts` | `db reset` OK; test pgTAP de estructura (tablas, índices, checks); tipos generados sin diff |
| T-005 | P1 | RLS v1 en todas las tablas, storage policies de `courier-docs` y matriz RLS | T-004 | `supabase/migrations/**`, `supabase/tests/rls_*.sql` | Matriz por rol: merchant, courier (approved, pending, suspended), admin y anon. Repartidor no aceptado **no** lee contactos. Lectura del bucket denegada |
| T-006 | P2 | Dominio puro: máquinas de estado de solicitud y oferta (§5), `DomainErrorCode`, `ActionResult`, `rpc-contracts.ts` (firmas de las RPC del §7), orden por `doc_level`, schemas Zod compartidos | T-000 | `src/domain/**` | Vitest: todas las transiciones válidas e inválidas por actor; orden de ofertas; 100 % de ramas en `domain` |
| T-007 | P1 | ADR-0001 Supabase (relacional/ACID, RLS, push manual, backups/PITR, costo por ambiente en USD) y ADR-0002 hosting y cron | T-002 | `docs/adr/**` | Revisión de las 3 personas; costos marcados como dato o supuesto |
| T-008 | P2 | Tokens semánticos (placeholder hasta el diseño) y primitivas accesibles: Button, Input, Select, Dialog de confirmación, Toast, EmptyState | T-000 | `src/ui/**` | Tests de componente de Dialog (foco atrapado, Esc); axe sin violaciones en un story de ejemplo |

**Congelamiento de contratos:** con T-004, T-005 y T-006 mergeadas, se etiqueta `contracts-v1`. Desde ahí, todo cambio es una tarea `contract-change` de P1 (o de P2 si es `domain`) con aviso al equipo.

### Fase 1 — Núcleo transaccional y flujos

| ID | Pista | Tarea | Dep | Archivos permitidos | DoD / pruebas |
|---|---|---|---|---|---|
| T-101 | P1 | RPC `submit_offer`, `withdraw_offer`, `set_availability` (piso desde settings, estado del repartidor, oferta activa única, rate limit) + wrappers | contracts-v1 | `supabase/migrations/**`, `supabase/tests/rpc_offers.sql`, `src/server/rpc.ts` | pgTAP con 999, 1000 y 1001; piso cambiado a 1500; pending, rejected y suspended rechazados; oferta duplicada; rate limit |
| T-102 | P1 | RPC `accept_offer` atómica e idempotente | T-101 | idem, `rpc_accept.sql` | Test de concurrencia (N=10, una sola ganadora); idempotencia; `ALREADY_MATCHED`; repartidor suspendido entre la oferta y la aceptación |
| T-103 | P1 | RPC del ciclo de solicitud: `publish_request` (piloto o suscripción), `cancel_request`, `mark_picked_up`, `mark_delivered`, `report_no_show`, `courier_cancel_match`, `republish_request`, `report_incident`; expiración perezosa; cálculo de `approx_distance_m` por zonas | contracts-v1 | idem, `rpc_requests.sql` | pgTAP de cada transición válida e inválida por actor y estado; solicitud vencida rechaza ofertas; suscripción vencida bloquea publicar |
| T-104 | P1 | `/api/cron/sweep`: persistir expiraciones, purgar documentos con `purge_after` vencido (Storage + `purged_at` + auditoría), marcar suscripciones vencidas; `/api/health` | T-103 | `src/app/api/cron/**`, `src/app/api/health/**`, `src/server/**` | Test de integración local: documento vencido purgado y auditado; sin `CRON_SECRET` devuelve 401 |
| T-111 | P2 | Auth (login y registro) + alta de comercio con consentimientos | T-005, T-006 | `src/features/auth/**`, `src/features/merchants/**`, `src/app/(public)/login/**`, `src/app/(merchant)/onboarding/**` | El comercio se registra y ve su panel; un repartidor no entra a `(merchant)` |
| T-112 | P2 | Crear solicitud: barrios, direcciones, destinatario con declaración de autorización, tipo de paquete, indicaciones y **medio de pago del destinatario** (el envío lo paga siempre quien recibe) | T-103 (o contrato de T-006 mientras tanto) | `src/features/requests/**`, `src/app/(merchant)/requests/new/**` | Validación Zod; sin piloto ni suscripción muestra el bloqueo; los contactos van a `delivery_request_contacts` |
| T-113 | P2 | Mis solicitudes + detalle con ofertas en tiempo real (orden por `doc_level`, opción de ordenar por precio, insignias) + aceptar con confirmación | T-102, T-112 | `src/features/requests/**`, `src/features/offers/**`, `src/app/(merchant)/requests/**` | Una oferta nueva aparece sin recargar; aceptar muestra `ALREADY_MATCHED` si corresponde |
| T-114 | P2 | Panel del repartidor: disponible/no disponible, lista única de solicitudes abiertas (sin contactos), ofertar con piso visible, retirar oferta, mis ofertas | T-101 | `src/features/availability/**`, `src/features/offers/**`, `src/app/(courier)/**` | Un repartidor pending ve la pantalla de "en revisión"; oferta bajo el piso muestra el error del servidor |
| T-115 | P2 | Vista de viaje (comercio y repartidor): revelación de contactos tras aceptar, foto/nombre/vehículo, WhatsApp `wa.me` (comercio ↔ repartidor y "Avisar a mi cliente" con el costo del envío), retirado/entregado, cancelar, "no llegó" y republicar | T-103, T-113 | `src/features/trips/**`, `src/app/(merchant)/trips/**`, `src/app/(courier)/trips/**`, `src/lib/whatsapp.ts` | Unit del link de WhatsApp (sin datos de más); las transiciones siguen la máquina de estados |
| T-121 | P3 | Onboarding del repartidor: DNI, selfie, avatar, vehículo, licencia y seguro opcionales, consentimientos, compresión en cliente, progreso y reintento, `dni_hmac` server-side | T-005 | `src/features/courier-onboarding/**`, `src/app/(courier)/onboarding/**`, `src/lib/image-compression.ts` | Unit de compresión; subida resistente a corte de red; un DNI repetido de un rechazado queda bloqueado |
| T-122 | P3 | Admin de repartidores: MFA obligatorio, cola de postulantes, visor de documentos (URL firmada + auditoría), aprobar, rechazar, suspender, verificar licencia y seguro | T-121, T-101 | `src/features/admin/**`, `src/app/(admin)/couriers/**` | Sin `aal2` no se entra; cada vista de documento genera una fila en `audit_log`; suspender retira las ofertas `pending` |
| T-123 | P3 | Admin de comercios y plataforma: piloto encendido/apagado, registrar pago y `paid_until`, `platform_settings` (piso, TTL, gracia, versión de términos) | T-005 | `src/features/admin/**`, `src/app/(admin)/merchants/**`, `src/app/(admin)/settings/**` | Cambiar el piso se refleja en `submit_offer`; cambios auditados |
| T-124 | P3 | Incidentes: botón en el viaje, bandeja admin, resolución y suspensión cautelar | T-103 | `src/features/incidents/**`, `src/app/(admin)/incidents/**` | Reporte visible para el admin; la suspensión cautelar actúa de inmediato |

### Fase 2 — PWA, notificaciones y accesibilidad

| ID | Pista | Tarea | Dep | Archivos permitidos | DoD / pruebas |
|---|---|---|---|---|---|
| T-201 | P3 | PWA: manifest, íconos maskable, service worker (shell offline, caché de lectura), onboarding de instalación iOS | T-000 | `public/**`, `src/app/manifest.ts`, `src/app/sw.ts` (o equivalente), `src/features/notifications/install/**` | Instalable en Chrome Android; E2E offline muestra el shell y un aviso |
| T-202 | P3 | Cliente de push: pedido de permiso desde un gesto, alta y baja de la suscripción, handlers `push` y `notificationclick` | T-201, T-203 | `src/features/notifications/**` | Permiso denegado sin romper el flujo; el click abre la pantalla correcta |
| T-203 | P1 | Emisor de push (fallo del Juez): RLS de `push_subscriptions`, `sendNotification(userIds, event)`, disparos post-commit, borrado ante 404/410, payload mínimo | T-103 | `src/server/push/**`, `src/app/api/push/**`, `supabase/migrations/**` | Test: el payload no contiene datos personales; una falla del emisor no revierte la transición; se borra la suscripción ante 410 |
| T-204 | P2 | Respaldo de tiempo real: hook con Realtime + refetch en focus/visibility/online + polling de 30 s en pantallas activas + badges de pendientes | T-113, T-114 | `src/features/{requests,offers}/hooks/**`, `src/lib/realtime.ts` | Con push apagado, una oferta nueva aparece al volver a la app |
| T-205 | P2 | Pasada de accesibilidad sobre todas las pantallas de comercio y repartidor | T-115 | `src/features/**` de P2, `src/ui/**` | axe AA sin violaciones; objetivos de 48 px; `inputmode` numérico |

### Fase 3 — Calidad, operación y salida

| ID | Pista | Tarea | Dep | Archivos permitidos | DoD / pruebas |
|---|---|---|---|---|---|
| T-301 | P3 | Arnés E2E: fixtures por rol, seed y limpieza en staging, page objects, `e2e-staging.yml` | T-003, Fase 1 | `e2e/**`, `.github/workflows/e2e-staging.yml` | Un spec de humo corre en CI contra staging |
| T-302 | P3 | E2E onboarding de repartidor + aprobación con MFA + DNI duplicado | T-301, T-122 | `e2e/specs/courier-onboarding.spec.ts` | Falla si se quita el chequeo de MFA |
| T-303 | P2 | E2E flujo principal: publicar, ofertar (piso), retirar, aceptar en dos pestañas, revelación progresiva, orden por documentación, medio de pago visible y mensaje "Avisar a mi cliente" con el monto aceptado | T-301, T-115 | `e2e/specs/main-flow.spec.ts` | Falla si el repartidor no aceptado ve el teléfono |
| T-304 | P2 | E2E estados: cancelaciones por actor y estado, "no llegó" y republicar, expiración, entregado | T-301, T-115 | `e2e/specs/request-states.spec.ts` | Cubre cada fila de la tabla §5.1 |
| T-305 | P3 | E2E autorización: pending no oferta, suspensión con ofertas activas, rol equivocado en rutas | T-301, T-122 | `e2e/specs/authorization.spec.ts` | — |
| T-306 | P3 | E2E piloto y suscripción: piloto encendido/apagado, `paid_until` vencido bloquea publicar | T-301, T-123 | `e2e/specs/subscription.spec.ts` | — |
| T-307 | P2 | E2E notificaciones y resiliencia: push denegado, respaldo en tiempo real, offline y reconexión | T-301, T-204, T-202 | `e2e/specs/notifications.spec.ts` | — |
| T-308 | P3 | E2E incidentes y suspensión cautelar | T-301, T-124 | `e2e/specs/incidents.spec.ts` | — |
| T-309 | P3 | E2E de carga de documentos con red lenta + axe en pantallas clave | T-301, T-121 | `e2e/specs/uploads-a11y.spec.ts` | — |
| T-310 | P1 | Operación: backups de producción y PITR según plan, exclusión del bucket documentada, simulacro de restauración en staging, Sentry sin datos personales, uptime de `/api/health` y alertas | T-104, T-007 | `docs/adr/**`, `docs/runbooks/**`, `src/server/observability/**` | Acta del simulacro; alerta de prueba recibida |
| T-311 | P3 | Páginas legales y consentimientos versionados (TyC con mercaderías prohibidas, privacidad, contrato de prestador, términos del piloto) | T-111, T-121 | `src/features/legal/**`, `src/app/(public)/legal/**` | Textos **revisados por un abogado** (bloqueante externo); se registra la versión aceptada |
| T-312 | Todos | Checklist de release `staging → main`: E2E verde, migraciones aplicadas, variables de producción, nota de rollback, abogado OK, simulacro OK | T-302…T-311 | `docs/runbooks/release.md` | PR `staging → main` aprobado por las 3 personas |

### Paralelismo sugerido (orden de arranque)

```text
Semana A:  P3 T-000 → T-001 → T-003     P1 T-002 → T-004 → T-005     P2 (tras T-000) T-006, T-008
           ── contracts-v1 ──
Semana B+: P1 T-101 → T-102 → T-103 → T-104 → T-203 → T-310
           P2 T-111 → T-112 → T-113 → T-114 → T-115 → T-204 → T-205 → T-303/T-304/T-307
           P3 T-121 → T-122 → T-123 → T-124 → T-201 → T-202 → T-301 → T-302/T-305/T-306/T-308/T-309 → T-311
Final:     T-312 (todos)
```

Mientras P1 no mergea una RPC, P2 y P3 construyen la UI contra `src/domain/rpc-contracts.ts` con un adaptador simulado detrás de `src/server/rpc.ts`, y lo cambian por el real cuando la RPC llega a develop.

## 8. Ficha de tarea (`docs/tasks/_plantilla.md`)

```markdown
# T-xxx — <título>
- Pista/dueño: P? · Estado: pendiente | en curso | en review | hecha
- Dependencias (mergeadas en develop): T-..., T-...
- Contratos a leer: src/domain/..., RPC ..., tablas ...

## Objetivo
<qué cambia para el usuario o el sistema, 2-3 líneas; referencia a §x del master plan>

## Archivos permitidos
- ruta/...

## Fuera de alcance
- ...

## Dependencias nuevas permitidas
- ninguna | paquete@versión (motivo)

## DoD
- [ ] Pruebas: ... (listar casos, incluidos bordes)
- [ ] pnpm typecheck && pnpm lint && pnpm test (&& pnpm test:db)
- [ ] Sin cambios fuera de "Archivos permitidos"
- [ ] PR con evidencia de checks y capturas si hay UI
```

## 9. Prompt de arranque para agy (por tarea)

```text
Tomá la tarea T-xxx de cadeApp usando la skill tomar-tarea.
Reglas: cumplí AGENTS.md y .agents/rules. Tocá solo los archivos permitidos de la ficha.
Si un contrato no alcanza, no lo cambies: detenete y escribí qué contract-change hace falta.
Escribí primero las pruebas del DoD y mostrá que fallan; después implementá hasta verlas verdes.
Al final mostrame la salida de typecheck, lint y tests, y un resumen de archivos cambiados.
No hagas push a develop/staging/main ni corras comandos contra Supabase remoto.
```

## 10. Coordinación del equipo

1. **Sincronización diaria corta:** qué tarea toma cada uno, qué contratos cambian y qué PRs esperan review.
2. **Reviews cruzadas:** cada PR lo aprueba alguien de otra pista. El revisor comprueba que el diff respete "Archivos permitidos" y que las pruebas fallen si se rompe la regla.
3. **Conflictos de contrato:** gana la base (P1). Si `domain` y la RPC difieren, se abre una `contract-change` y se detienen las tareas afectadas.
4. **Migraciones:** una sola persona las mergea (P1), siempre en orden y nunca dos migraciones de PRs distintos a la vez sin rebase.
5. **Sesiones de agy:** una sesión por tarea y por rama. No reutilizar una conversación de otra tarea, para que el contexto no arrastre decisiones ajenas.
6. **Registro de decisiones:** una decisión técnica nueva se escribe en `docs/adr/`. Una de producto vuelve al master plan (y, si es grande, a una nueva revisión del Consejo).
