# cadeApp — Plan de implementación para agentes (agy) · v2.5

> Revisado por El Consejo en `revision-3` (2026-09-18). **Estado: APROBADO CON RESOLUCIÓN D16.** El registro está en `.el-consejo/revision-3/`.
> Qué construir: [master-plan.md](master-plan.md). Reglas y skills de agy: [`.agents/`](../.agents/). Diseños y especificaciones vinculantes: [`docs/design/stitch/exports/`](design/stitch/exports/registro.md).
> Somos 3 personas con agy, trabajando **en simultáneo** y **en horarios distintos**. **Lautaro073** es el **único programador y líder técnico**:
> programa la zona más crítica (datos y servidor) y el arranque, y revisa todo. Las otras dos personas **no saben programar**:
> operan agy como herramienta de codificación asistida mediante fichas, skills y prompts predefinidos. **agy es quien codifica**,
> se autoinstruye con las reglas y skills del kit, y frena ante dudas. Este documento asegura que nadie se pise y que el código
> mantenga calidad estricta sin depender de que P2 o P3 escriban código a mano.

---

## 0. Arranque rápido por rol

| Si sos… | Leé primero | Tu primera tarea |
|---|---|---|
| Persona 1 · Lautaro073 (líder técnico y programador: datos, servidor y arranque) | §3.7 Día 0, §2, §7.1 | Día 0 (humano) → T-000 |
| Persona 2 · App de comercio y repartidor (operador de agy) | §3.8, §7.2, `.agents/rules/20-arquitectura.md` | T-006 y T-008 (cuando T-000 esté mergeada) |
| Persona 3 · Admin, PWA y calidad (operador de agy) | §3.8, §7.3, `.agents/rules/40-testing.md` | T-201 (cuando T-000 esté mergeada) |

Todos: [`docs/guia-prompts.md`](guia-prompts.md) (**manual de prompts para copiar y pegar según tu rol**), `docs/onboarding.md` (en el kit), §3 (coordinación) y la skill `tomar-tarea`.

## 1. Principios

1. **Primero los contratos, después el código.** El esquema, los tipos generados, `rpc-contracts.ts`, los códigos de error y las primitivas de UI se congelan en `contracts-v1`. Un cambio posterior pasa por contract-change (§3.5).
2. **Una tarea = un issue = una rama = un PR = una persona a la vez.** La ficha dice qué archivos se pueden tocar.
3. **Nada queda solo en una máquina.** Cada sesión termina con bitácora, commit y push (skill `cerrar-sesion`).
4. **Nadie retoma a ciegas.** Antes de continuar se recupera el estado real y se vuelven a correr los checks (skill `retomar-tarea`).
5. **La base es la autoridad de seguridad.** Estados, piso, aceptación y autorización se validan en RPC y RLS. La UI nunca es la única barrera.
6. **Un solo experto, agy codificando y muchas redes.** Como Lautaro073 es el único con experiencia en programación y las otras dos personas operan agy sin saber programar, agy escribe el código y genera sus pruebas automáticamente. Lo que no puede revisar una persona no-técnica lo cubren CI, el informe de revisión de agy y reglas que obligan al agente a frenar y consultar.
7. **Controles técnicos, no solo texto.** Las reglas de agy se apoyan en un hook que bloquea comandos, en CI obligatorio, en el check `approval-policy` y en que ninguna laptop tenga credenciales de producción.
8. **Nada se da por verificado sin evidencia.** Toda prueba nueva se demuestra fallando al romper la regla que prueba.

## 2. Equipo, zonas y aprobaciones

Completar al crear el repo:

| Persona | Usuario de GitHub | Rol |
|---|---|---|
| Persona 1 | `@Lautaro073` | Líder técnico y desarrollador. Programa datos, servidor y arranque (T-000, T-001, T-003). Revisa y aprueba los PR de las otras dos personas. Único administrador de producción. |
| Persona 2 | `@KiraK72` | Operador de agy (no programador) en la zona App de comercio y repartidor. agy codifica y ejecuta las skills bajo su cuenta. |
| Persona 3 | `Pendiente` | Operador de agy (no programador) en la zona Admin, PWA y calidad. agy codifica y ejecuta las skills bajo su cuenta (Lautaro073 cubre provisoriamente). |

| Zona | Rutas | Dueña |
|---|---|---|
| Datos, servidor y plataforma | `supabase/**`, `src/server/**`, `src/app/api/**`, `src/types/database.types.ts`, `docs/adr/**`, `package.json`, `pnpm-lock.yaml`, `middleware.ts`, `src/app/layout.tsx`, `src/app/providers.tsx`, `.github/**`, `.agents/**`, `AGENTS.md` | P1 · Lautaro073 |
| App de comercio y repartidor | `src/domain/**`, `src/ui/**`, `src/lib/**`, `src/features/{auth,merchants,requests,offers,trips,availability}/**`, `src/app/(merchant)/**`, `src/app/(courier)/**` | P2 |
| Admin, PWA y calidad | `src/features/{courier-onboarding,admin,incidents,notifications,legal}/**`, `src/app/(admin)/**`, `src/app/(public)/**`, `public/**`, `e2e/**` | P3 |

La zona sirve para repartir tareas y coordinar, no para aprobar.

**Quién aprueba cada PR** (checkpoint revision-2, ajustado al equipo real):
- **PR de Persona 2 o Persona 3:** lo aprueba **Lautaro073**, siempre. Antes de pedir revisión, quien lo abre adjunta el informe de revisión de agy (skill `revisar-pr`) con lo bloqueante corregido.
- **PR de Lautaro073:** los aprueba y mergea **él mismo**. P2 y P3 no programan, así que no pueden revisar código; pedirles una aprobación sería un requisito que nadie puede cumplir, y GitHub además no permite aprobar el propio PR. Lo que reemplaza a la aprobación de un par es la **revisión independiente**, que corre sobre el PR ronda por ronda hasta que no queda ningún hallazgo abierto y deja el informe de `revisar-pr` en el cuerpo. Antes de mergear, Lautaro073 verifica:
  1. que CI esté verde, incluidas las pruebas de base y `rls_enabled.sql`;
  2. que el cuerpo traiga el informe de `revisar-pr` sin hallazgos bloqueantes;
  3. que el checklist de seguridad esté marcado.

  Si el informe marca algo bloqueante, no se mergea: se corrige y se vuelve a revisar.
- **Check de CI `approval-policy`** (T-003): falla si un PR de P2 o P3 no tiene la aprobación de Lautaro073, o si un PR de Lautaro073 no tiene la sección de informe de agy completa. **En los PR de Lautaro073 no exige aprobación de un par, a propósito:** no hay quién la dé.
- **Tocar la zona de otra persona:** la ficha nombra la subruta y la dueña de esa zona deja un comentario de visto bueno para coordinar. El visto bueno no reemplaza la aprobación.
- **Producción:** solo Lautaro073 ve y rota los secretos de producción, aprueba el environment `production` y el PR `staging → main`. Lo hace desde las consolas web con 2FA. **Su máquina de desarrollo, donde corre agy, tampoco guarda credenciales de staging ni de producción.**
- **Sin respaldo experto en la base:** si Lautaro073 no está, no se mergean migraciones ni cambios de RLS o RPC. P2 y P3 siguen contra el fake de RPC (§3.4). No hay procedimiento de emergencia (break-glass). Nunca se aplican migraciones a mano: solo `migrate.yml`.

## 3. Cómo nos coordinamos sin pisarnos

### 3.1 Dónde vive cada cosa

| Qué | Dónde | Quién lo actualiza |
|---|---|---|
| Qué hay que hacer (spec) | `docs/tasks/T-xxx.md` en develop | Por PR; aprueba Lautaro073 |
| Quién la tiene y en qué estado | Issue de GitHub + Project "cadeApp" | La persona |
| Trabajo en curso | Rama `feat/T-xxx-slug` + PR en **Draft** desde el primer push | Agente y persona |
| Qué pasó en cada sesión | `docs/tasks/log/T-xxx.md` en la rama | El agente, al cerrar sesión |
| Cambios de contrato | `docs/contracts/CC-nnn.md` + issue `contract-change` | Quien lo necesita |
| Decisiones técnicas | `docs/adr/` | Por PR |

Columnas del Project: **Bloqueada** (faltan dependencias) → **Lista** (dependencias mergeadas) → **En curso** → **En review** → **Hecha**.
Labels: `P1`, `P2`, `P3`, `fase-0` a `fase-3`, `bloqueada`, `contract-change`, `alto-riesgo`, `necesita-lautaro`.

### 3.2 Ciclo de una tarea
1. **Elegir:** tomá la primera tarea "Lista" de tu tablero (§7). Si no tenés ninguna, podés tomar una "Lista" de otra zona: avisá en el issue y la dueña de esa zona deja su visto bueno en el PR. Asignate el issue y movelo a "En curso".
2. **Arrancar con agy:** "Tomá T-xxx con la skill `tomar-tarea`". Crea la rama, la bitácora y las pruebas del DoD, pushea, y abrís el PR en Draft (`[T-xxx] …`, `Closes #n`).
3. **Trabajar por sesiones.** Al terminar cada una: "Cerrá la sesión con `cerrar-sesion`".
4. **Pedir revisión:** con el DoD completo y la evidencia pegada, se corre la skill `revisar-pr` sobre el propio PR, se corrige lo bloqueante y se pega el informe. Recién entonces el PR pasa a "Ready for review" y el issue a "En review". Aprueba según §2.
5. **Merge:** squash, hecho por el autor después de la aprobación con los checks verdes. Quien mergea mueve a "Lista" las tareas que dependían de esta.

### 3.3 Continuar el trabajo de otra persona (o el propio otro día)
- **Traspaso:** quien suelta la tarea comenta en el issue "Suelto T-xxx; bitácora al día en `<hash>`" y se desasigna. Quien la toma se asigna y comenta "Retomo T-xxx".
- **Con agy:** "Retomá T-xxx con la skill `retomar-tarea`". El agente:
  1. trae la rama remota;
  2. compara el último commit con la bitácora;
  3. rebasea;
  4. vuelve a correr los checks antes de tocar nada;
  5. desmarca del DoD lo que ya no pasa;
  6. sigue desde "Próximo paso".
- Si la bitácora y el remoto no coinciden, se frena y se consulta en el issue.

### 3.4 Trabajo simultáneo: reglas de convivencia
- **Rebase** sobre `origin/develop` al empezar cada sesión y antes de pedir revisión.
- **`package.json` y `pnpm-lock.yaml`:** solo se agregan dependencias que figuren en la ficha. Si hay conflicto en el lockfile: `git checkout origin/develop -- pnpm-lock.yaml` y `pnpm install`.
- **`src/types/database.types.ts`:** lo regenera solo un PR de migración.
- **Migraciones:** si hay dos PRs, el segundo rebasea y vuelve a correr `pnpm test:db` antes del merge.
- **Wrappers de RPC por dominio** (`src/server/rpc/{offers,requests,admin}.ts`), para que dos tareas no editen el mismo archivo.
- **Rutas de otra zona:** solo si la ficha nombra la subruta concreta (nunca el grupo entero). La dueña de esa zona deja su visto bueno; la aprobación sigue §2.
- **Archivos raíz** (`layout.tsx`, `providers.tsx`, `middleware.ts`, `package.json`): son de Lautaro073. Otras zonas los tocan solo si la ficha lo dice.
- **Mientras no exista la RPC real:** la UI usa el fake de `src/domain/testing/rpc-fake.ts` (`RPC_ADAPTER=fake`) y se cambia por la real cuando llega a develop.

### 3.5 Cambios de contrato (decisión del checkpoint)
1. Quien detecta la diferencia frena, cierra la sesión y usa la skill `contract-change`: crea `docs/contracts/CC-nnn.md`, abre un issue `contract-change` y marca `bloqueada` las tareas afectadas.
2. Si el dominio y la RPC no coinciden, **no gana nadie por defecto**: validan P2 (dueña de `src/domain`) y P1 (dueño de esquema y RPC).
3. Si el cambio toca una decisión D1–D14 del master plan o algo que ve el usuario, **decide Lautaro073 antes del merge**.
4. Nunca se debilita un chequeo de seguridad de RPC, RLS o storage para que coincida con el dominio.
5. El CC se mergea primero; después se desbloquean las tareas y se retoman.

### 3.6 Esperas y bloqueos
- Las fases ordenan prioridad, no bloquean: una tarea está "Lista" cuando sus dependencias están mergeadas, aunque sea de una fase posterior.
- Si estás esperando: revisá PRs de tu zona, avanzá con el fake (§3.4) o tomá la siguiente tarea "Lista" de tu tablero.
- **Bloqueo:** label `bloqueada` y un comentario en el issue con qué falta y de quién depende.
- **La revisión de Lautaro073 es el cuello de botella previsto.** Para achicarlo: PRs chicos, informe de agy adjunto y CI verde antes de pedirla. Si una revisión lleva más de 1 día hábil, el autor avisa en el issue y toma la siguiente tarea "Lista".

### 3.7 Día 0 (Lautaro073, sin agentes)
1. Crear el repo privado `cadeapp` en GitHub, invitar a las 3 personas y exigir 2FA.
2. Crear `develop` y `staging` desde `main` y crear el Project "cadeApp" con las columnas y labels de §3.1.
3. Crear la organización de Supabase y los **2 proyectos remotos del Free Tier**: `cadeapp-prod` (producción) y `cadeapp-staging` (staging y develop compartido, en T-002). Se utiliza `cadeapp-staging` tanto para develop como para staging, descartando Docker local para agilizar el onboarding de los operadores de agy y mantener costo $0 sin límites excedidos.
4. Hosting: proyecto con ambientes de preview y producción. Producción la administra solo Lautaro073.
5. Crear los GitHub Environments `staging` y `production` (este último con Lautaro073 como required reviewer). Los secretos se cargan a medida que las tareas los piden.
6. Subir a `main` los documentos `docs/master-plan.md` y `docs/implementation-plan.md`, y completar la tabla de §2.
7. Pedirles a P2 y P3 que sigan `docs/onboarding.md` y lean §3.8 mientras Lautaro073 hace T-000.

### 3.8 Guía para quienes operan agy sin saber programar (P2 y P3)
Como operador de agy no necesitás saber programar: **agy es quien escribe el código, corre las pruebas y genera los commits**. Tu rol es dirigirlo con las skills y vigilar que no se desvíe. **Toda la secuencia de prompts listos para copiar y pegar está en [`docs/guia-prompts.md`](guia-prompts.md)**:
1. **El prompt manda:** Para cada tarea en "Lista", abrí agy y dale la instrucción prearmada de [`docs/guia-prompts.md`](guia-prompts.md) (ej: *"Tomá T-xxx de cadeApp con la skill tomar-tarea..."*). El agente leerá la ficha, sabrá qué archivos puede tocar y se autoinstruirá paso a paso.
2. **agy hace TDD:** El agente escribirá primero las pruebas del DoD, te mostrará que fallan en rojo, luego implementará la feature y te mostrará que pasan en verde.
3. **No pidas "arreglá todo":** Si una prueba falla y agy no logra resolverla con el diseño previsto, **nunca le pidas que cambie la prueba para que pase a la fuerza**. Decile: *"Cerrá la sesión con cerrar-sesion"* y dejale un comentario a Lautaro073 en el issue con la salida del error.
4. **Frenos obligatorios:** Frená la sesión y consultale a Lautaro073 en el issue si:
   - agy propone tocar archivos fuera de "Archivos permitidos", modificar contratos, tocar RLS o instalar librerías no aprobadas;
   - el guard técnico (`agent-guard.mjs`) bloquea una acción;
   - agy entra en un bucle o propone soluciones complejas no especificadas.
5. **Cierre y revisión:** Al terminar una sesión, pedile a agy: *"Cerrá la sesión con cerrar-sesion"*. Cuando la tarea esté lista: *"Revisá el PR de T-xxx con la skill revisar-pr y dame el informe"*. Pegás ese informe en el PR y Lautaro073 se encarga de la aprobación técnica.
6. **Corte por cuota de IA:** Si agy se queda sin mensajes a mitad de sesión, correte a la terminal o pedile antes del corte: `git add -A && git commit -m "wip(T-xxx): corte por cuota" && git push`, y agregá una línea en la bitácora (`docs/tasks/log/T-xxx.md`).
7. **Bitácora clara:** agy actualizará la bitácora por vos al cerrar sesión; revisá que explique en lenguaje claro qué se hizo y qué falta.

## 4. Estructura del repositorio y fronteras

```text
cadeapp/
├─ AGENTS.md · .agents/{rules,skills,scripts,hooks.json}      # kit de agy (T-001)
├─ .github/{workflows,CODEOWNERS,pull_request_template.md}
├─ docs/{master-plan.md,implementation-plan.md,onboarding.md,adr/,tasks/,tasks/log/,contracts/,runbooks/}
├─ supabase/{AGENTS.md,config.toml,migrations/,seed.sql,tests/}
├─ middleware.ts                                               # solo llama a features/auth/server.ts
├─ src/
│  ├─ app/{layout.tsx,providers.tsx,(public),(merchant),(courier),(admin),api/{cron,push,health}}
│  ├─ domain/{AGENTS.md,states/,errors.ts,rpc-contracts.ts,schemas/,testing/rpc-fake.ts}
│  ├─ features/_template/ y features/<modulo>/{components/,hooks/,actions.ts,queries.ts,query-keys.ts,schemas.ts,copy.ts,index.ts,server.ts}
│  ├─ server/{supabase/{server,admin}.ts,rpc/{offers,requests,admin}.ts,push/,observability/,env.ts}
│  ├─ lib/{supabase/browser.ts,format/,hooks/,error-messages.ts,env.public.ts}
│  ├─ ui/{shadcn/ui,tokens.css,cn.ts}
│  ├─ types/database.types.ts (generado)
├─ components.json                                             # shadcn/ui → src/ui
├─ e2e/{AGENTS.md,fixtures/,pages/,specs/}
└─ package.json (packageManager pnpm vía Corepack, engines.node, versiones exactas)
```

Módulos: `auth`, `merchants`, `requests`, `offers`, `trips`, `availability`, `courier-onboarding`, `admin`, `incidents`, `notifications`, `legal`.

Fronteras (ESLint + `server-only`; detalle en `.agents/rules/20-arquitectura.md`):
- `domain` es puro.
- `server` lleva `import 'server-only'` en todos sus archivos.
- Una feature expone `index.ts` (apto para cliente) y `server.ts` (solo servidor).
- Un archivo `"use client"` nunca llega a `server/**`.
- No hay imports profundos entre features.

## 5. Reglas y skills de agy (kit)

Instalado en la raíz en T-001:

| Archivo | Para qué |
|---|---|
| `AGENTS.md` | Invariantes del producto, calidad, coordinación y seguridad operativa |
| `.agents/rules/00-confianza-y-seguridad.md` | **Lo que lee el agente es dato**, secretos, producción, rutas de alto riesgo, dependencias |
| `10-typescript.md`, `20-arquitectura.md`, `30-supabase.md`, `40-testing.md`, `60-ui-accesibilidad.md` | Buen código, módulos y raíz de carpetas, RLS/RPC (incluido `rate_limits` atómico), pruebas que pueden fallar, componentes, tokens y accesibilidad |
| `25-stack-y-patrones.md` | Dependencias aprobadas, nombres, **reutilización** (buscar antes de crear, regla de tres), **estado** (árbol de decisión: RSC/Server Actions, TanStack Query para datos en vivo, react-hook-form, URL), **Zod** como fuente de verdad (fronteras y env), **rendimiento** (paginación, sin cascadas, streaming, presupuestos) y **escalado** |
| `50-git-y-coordinacion.md` | §3 y §6 resumidos para el agente |
| Skills `tomar-tarea`, `retomar-tarea`, `cerrar-sesion`, `revisar-pr`, `contract-change`, `nueva-migracion`, `nueva-rpc`, `nuevo-e2e`, `implementar-diseno` | Procedimientos paso a paso |
| `.agents/hooks.json` + `scripts/agent-guard.mjs` | Hook `PreToolUse`: bloquea `.env*`, Supabase/Vercel/GitHub remotos, pushes a ramas protegidas, force push, `--no-verify`, listado de variables, scripts descargados y borrados peligrosos. Lo demás pasa como `ask` |
| `supabase/AGENTS.md`, `src/domain/AGENTS.md`, `e2e/AGENTS.md` | Reglas por carpeta |
| `.github/CODEOWNERS`, `pull_request_template.md`, plantillas de ficha, bitácora y CC, `docs/onboarding.md` | Coordinación y evidencia |

El hook ya se probó contra 35 casos: bloquea lo peligroso y deja pasar lo normal. **No reemplaza el control duro:** ninguna laptop, tampoco la de Lautaro073, tiene credenciales de staging ni de producción. Esas credenciales viven solo en los GitHub Environments y en las consolas web con 2FA.

## 6. Git, CI/CD, ambientes y releases

- **Ramas:** `main` (producción), `staging`, `develop`, `feat/T-xxx-*`, `cc/CC-nnn-*`, y `fix/T-xxx-*` para hotfix.
- **Protección** (en `develop`, `staging` y `main`):
  - PR obligatorio, checks verdes (incluido `approval-policy`) y rama al día;
  - sin push directo ni force push, tampoco para administradores;
  - en `main` se suma el check `e2e-staging`;
  - **sin «require approvals»:** GitHub no distingue por autor, así que exigir una review aprobatoria bloquearía para siempre los PR de Lautaro073, que nadie más puede aprobar (§2). La aprobación de los PR de P2 y P3 la exige el check `approval-policy`, que sí distingue el autor.
- **Hasta que T-003 esté mergeada,** cada PR lleva la salida local de los checks pegada y se aprueba según §2. Los PR de Lautaro073 los mergea él con el informe de la revisión independiente en el cuerpo.
- **`ci.yml`:** corre en paralelo `typecheck`, `lint`, `unit` + cobertura (umbral en `src/domain`), `db-tests` (Supabase local, `rls_enabled.sql`, `db:types` sin diff) y `build`.
  - Usa caché de pnpm y de las imágenes de Supabase. Objetivo: menos de 10 minutos.
  - `pnpm audit --audit-level=high` solo avisa hasta `contracts-v1`; después bloquea.
  - Las Actions de terceros van fijadas por SHA.
- **`migrate.yml`:** al mergear a `staging` aplica `supabase db push` a `cadeapp-staging`. Al mergear a `main`, aplica a `cadeapp-prod` (exigiendo la aprobación de Lautaro073 en el environment `production`). En `develop`, la verificación de migraciones se realiza en CI con Docker en el runner de GitHub, sin requerir una base remota compartida.
  - `concurrency: migrate-<ambiente>` con `cancel-in-progress: false`.
  - En `production` exige la aprobación de Lautaro073 en el environment.
- **`e2e-staging.yml`:** corre después del deploy a staging, con `concurrency: e2e-staging`.
  - Los specs que cambian `platform_settings` van en el proyecto serial `global-settings`.
- **Release semanal:**
  - el capitán de release (rota P1 → P2 → P3) abre `develop → staging` solo con develop verde; el PR de release no resuelve conflictos;
  - con la suite E2E verde en staging, Lautaro073 aprueba `staging → main`.
- **Hotfix:** `fix/T-xxx-*` desde `main`, aprobado por Lautaro073, con back-merge a `staging` y `develop` el mismo día. Si lleva migración, es hacia adelante y entra a develop antes de seguir.
- **Rollback:** la app vuelve al deploy anterior del hosting; la base se corrige con otra migración. Cada release lleva su nota de rollback.

## 7. Tableros por persona

Cada tablero está en orden. `∥` = se puede hacer en paralelo con la anterior.

### 7.1 Persona 1 · Lautaro073 · Datos, servidor y arranque (15 tareas + revisión)
1. T-000 Scaffold mínimo (máximo 1 día; destraba a todos)
2. T-001 Kit de agy, CODEOWNERS, Project e issues (con P2 y P3 en el simulacro de traspaso) · ∥ T-002 Supabase local, clientes y proyectos staging/prod (Free Tier)
3. T-003 CI/CD, protecciones y `approval-policy`
4. T-004 Esquema v1 · ∥ T-007 ADRs
5. T-005 RLS v1 → **`contracts-v1`**, junto con T-006 de P2
6. T-101 RPC de ofertas → T-103 RPC de solicitudes (no dependen entre sí: hacé primero la que destrabe a quien esté esperando)
7. T-102 `accept_offer`
8. T-106 Migración, RLS de coordenadas y RPC `calculate_route_distance` (Haversine × 1.30, bounding box Aguilares, fallback a `zones`)
9. T-105 RPC de admin (destraba T-122 y T-123 de P3)
10. T-104 Cron y health
11. T-203 Emisor de push (destraba T-202 de P3)
12. T-310 Operación, backups y simulacro de restauración

Siempre: revisar y aprobar los PR de P2 y P3 (§2), y atender las preguntas de §3.8 en los issues. Conviene reservar un bloque diario para revisiones, así nadie queda trabado.

### 7.2 Persona 2 · App de comercio y repartidor (16 tareas)
1. T-006 Dominio y fake de RPC · ∥ T-008 Tokens de Stitch (D16), primitivas de UI, `<BrandLogo />` en `public/brand/` y piso 14px
2. T-009 Auth base (después de T-004 y T-005)
3. T-111 Alta de comercio (con pin en mapa de Aguilares y fallback a texto)
4. T-112 Crear solicitud (con pin de entrega opcional en mapa de Aguilares, retiro precargado y selector de cambio en efectivo)
5. T-116 Componente de mapa `src/ui/map.tsx` (import dinámico) y selector interactivo de pin para comercio
6. T-114 Panel del repartidor (con el fake hasta T-101; solo barrio y distancia aproximada, sin mapa, sin precio sugerido y sin ciudades ajenas)
7. T-113 Mis solicitudes, ofertas y aceptar (real después de T-102; sin estrellas ni calificaciones según S4)
8. T-115 Vista de viaje y WhatsApp
9. T-117 Mapa de recorrido y botón "Abrir en Google Maps" en viaje activo (C06, R07; post-aceptación)
10. T-204 Respaldo de tiempo real
11. T-205 Pasada de accesibilidad
12. T-313 E2E de registro de comercio · ∥ T-303 E2E del flujo principal · ∥ T-304 E2E de estados · ∥ T-307 E2E de notificaciones

Mientras esperás T-000: onboarding (`docs/onboarding.md`) y lectura del master plan. Después: tests de dominio, estados vacíos y de error, y visto bueno cuando otra zona toca `src/ui` o las rutas de comercio y repartidor.

### 7.3 Persona 3 · Admin, PWA y calidad (14 tareas)
1. T-201 PWA (depende solo de T-000)
2. T-121 Onboarding del repartidor (después de T-009 y T-008)
3. T-123 Admin de comercios y plataforma (después de T-105; sin CUIT y sin solapa de liquidaciones en TopNav)
4. T-122 Admin de repartidores
5. T-124 Incidentes
6. T-202 Cliente de push (después de T-203)
7. T-301 Arnés E2E
8. T-302 E2E de onboarding · ∥ T-305 E2E de autorización · ∥ T-306 E2E de piloto y suscripción · ∥ T-308 E2E de incidentes · ∥ T-309 E2E de cargas y accesibilidad · ∥ T-314 E2E de mapas, privacidad y degradación
9. T-311 Páginas legales (bloqueante externo: abogado)

Mientras esperás T-000: onboarding y lectura del master plan. Después: preparar fixtures y page objects para T-301, y visto bueno cuando otra zona toca `(public)`, `(admin)` o `e2e/`.

### 7.4 Final: T-312 (las tres personas, aprueba Lautaro073)

## 8. Tareas

`contracts-v1` = T-004 + T-005 + T-006 mergeadas. Todas las fichas incluyen el DoD común: checks verdes, sin cambios fuera de "Archivos permitidos", bitácora al día, informe de `revisar-pr` en el PR, y cada prueba nueva demostrada fallando al romper la regla que prueba. "(visto bueno Px)" significa que la dueña de esa zona comenta su conformidad; la aprobación sigue §2.

### Fase 0 — Fundaciones y contratos

| ID | Quién | Tarea | Depende de | Archivos permitidos | DoD específico |
|---|---|---|---|---|---|
| T-001 | P1 | Instalar kit de agy en la raíz, CODEOWNERS con usuarios reales, Project y labels, un issue por tarea, fichas de Fase 0 y 1 | T-000 | `AGENTS.md`, `.agents/**`, `.github/CODEOWNERS`, `.github/pull_request_template.md`, `docs/**`, `supabase/AGENTS.md`, `src/domain/AGENTS.md`, `e2e/AGENTS.md`, `tools/**` | GitHub no marca errores en CODEOWNERS; con agy en las máquinas de las 3 personas, leer `.env.local`, `pnpm supabase db push` y `git push origin develop` quedan bloqueados y `pnpm test` pide permiso normal; **simulacro de traspaso:** P2 empieza una ficha de prueba y P3 la retoma con `retomar-tarea` (acta en la bitácora); P2 y P3 generan un informe de `revisar-pr` sobre el PR de T-001 |
| T-002 | P1 | Clientes @supabase/ssr (`src/lib/supabase/browser.ts` y `src/server/supabase/{server,admin}.ts`), configuración remota para `cadeapp-staging` vía variables de entorno, script `pnpm db:types` remoto, sección de base en `docs/onboarding.md` (sin Docker local) | T-000 | `supabase/config.toml`, `src/server/supabase/**`, `src/lib/supabase/**`, `tools/**`, `.eslintrc.json`, `package.json`, `pnpm-lock.yaml`, `.env.example`, `docs/onboarding.md`, `docs/tasks/**`, `docs/implementation-plan.md` | Variables de entorno validadas con `cadeapp-staging`; no hay claves en el repo; clientes de servidor tienen `server-only` y browser en `src/lib`; script `db:types` seguro en `tools/db-types.mjs` (verificación de drift asignada al CI en T-003) |
| T-003 | P1 | `ci.yml`, `migrate.yml`, `approval-policy.yml`, protecciones y environments según §6 | T-000, T-002 | `.github/workflows/**` | Un PR con error de tipos queda bloqueado; `ci.yml` falla si `db:types` deja drift de `database.types.ts` usando `SUPABASE_PROJECT_REF` (demostrado plantando un diff); CI con caché en menos de 10 minutos; una migración vacía de prueba se aplica en staging; dos merges seguidos no migran en paralelo; Actions fijadas por SHA; `approval-policy` bloquea un PR de prueba de P2 sin aprobación de Lautaro073 y uno de Lautaro073 sin informe de agy; job `bundle-budget` informa el first-load JS por ruta y avisa si supera el presupuesto de la regla 25 |
| T-004 | P1 | Esquema v1 (§7 del master plan), trigger de alta (rol desde metadatos, solo `merchant` o `courier`), seed de zonas y settings, tipos generados | T-002 | `supabase/migrations/**`, `supabase/seed.sql`, `supabase/tests/structure.sql`, `src/types/database.types.ts` | pgTAP de estructura (tablas, índices únicos parciales, checks); registrarse con rol `admin` no crea un admin; tipos sin diff |
| T-005 | P1 | RLS v1, storage `courier-docs`, matriz RLS, `rls_enabled.sql` | T-004 | `supabase/migrations/**`, `supabase/tests/rls_*.sql` | Matriz por rol (merchant, courier approved/pending/suspended, admin, anon); un repartidor no aceptado no lee contactos; el bucket no se puede leer; `rls_enabled.sql` falla con una tabla sin RLS (demostrado) |
| T-006 | P2 | Estados, `DomainErrorCode`, `ActionResult`, `rpc-contracts.ts` (todas las RPC, incluidas las `admin_*`), schemas Zod, orden por `doc_level`, `testing/rpc-fake.ts` | T-000 | `src/domain/**` | Transiciones válidas e inválidas por actor; orden de ofertas; el fake devuelve cada código de error; umbral de cobertura de ramas ≥ 90 % configurado |
| T-007 | P1 | ADR-0001 Supabase (relacional, RLS, push manual, backups/PITR, costo por ambiente en USD) y ADR-0002 hosting y cron | T-002 | `docs/adr/**` | Revisados por las 3 personas; cada costo marcado como dato o supuesto |
| T-008 | P2 | Base de UI y tokens de Stitch (D16): tokens canónicos en `src/ui/tokens.css` mapeados a variables CSS de shadcn/ui (`--primary: #09BABD`, `--primary-foreground: #12182C` WCAG AAA 7.35:1, `--background: #FDFCFB`, `--card: #FFFFFF`, `--border: #E4E7EC`, radio 10px), componente `<BrandLogo />` (`src/ui/brand-logo.tsx`) con SVGs optimizados (< 5 KB) y WebP en `public/brand/` (sin importar los archivos fuente de `assets/` directo al bundle; PNGs rasterizados obligatorios en `public/` para PWA manifest), ruta de muestra S00 en `src/app/design-system/page.tsx`, cláusula Anti-12px (piso tipográfico `text-sm` 14px Inter 500/600), `BottomNav` móvil (48px targets, safe-area inset), `TopBar` marino 56px (`#12182C`), componentes shadcn/ui en `src/ui` sobre primitivas reales Radix y `react-hook-form` (Button con estado pendiente, Input, Select, Textarea, Form con react-hook-form, Dialog de confirmación, Sheet, Badge, Card, **Skeleton**, EmptyState), **Sonner** (`Toaster` de shadcn/ui + helper `src/ui/notify.ts`), **Motion** (presets en `src/ui/motion/` y `MotionProvider` con `LazyMotion` y `MotionConfig reducedMotion="user"` de `motion/react`), montaje de `Toaster` y `MotionProvider` en `providers.tsx`, y formateadores `src/lib/format/` (`formatArs`, `formatDate`, `formatPhone`) | T-000 | `src/ui/**`, `src/lib/format/**`, `src/lib/error-messages.ts`, `src/app/providers.tsx` (visto bueno P1), `src/app/design-system/**`, `public/**`, `package.json`, `pnpm-lock.yaml`, `vitest.config.ts` | Tests del Dialog (foco automático al abrir, retorno al disparador al cerrar, foco atrapado, Esc), de `notify` (usa los mensajes y reemplaza toasts por id en Sonner) y de los formateadores (ARS sin decimales, fecha en zona Argentina); verificación de contraste WCAG AA/AAA (AAA 7.35:1 en botones primarios y cobertura de todos los pares semánticos); piso tipográfico 14px sin excepciones móviles verificado contra `tailwind.config.ts`; bundle size de `<BrandLogo />` < 5 KB y assets reales en `public/`; con `prefers-reduced-motion` los presets no desplazan y `.animate-pulse`/`.animate-spin` se desactivan; auditoría estructural DOM sin violaciones en la página de muestra S00 (`@axe-core/playwright` pasa a E2E según `D03`); ningún valor de estilo arbitrario; umbral de cobertura ≥ 80 % de ramas en `src/ui/**` (`D04`) |
| T-009 | P2 | Auth base: login, registro con rol, logout, sesión/rol/aal, guardas por rol, función de sesión para `middleware.ts` | T-004, T-005, T-006 | `src/features/auth/**`, `src/app/(public)/login/**` y `src/app/(public)/register/**` (visto bueno P3), `middleware.ts` | merchant y courier se registran con su rol; rol admin rechazado; courier no entra a `(merchant)` ni merchant a `(courier)`; tests unitarios de guardas |

### Fase 1 — Núcleo transaccional y flujos

| ID | Quién | Tarea | Depende de | Archivos permitidos | DoD específico |
|---|---|---|---|---|---|
| T-101 | P1 | `submit_offer`, `withdraw_offer`, `set_availability`, `rate_limits` atómico | contracts-v1 | `supabase/migrations/**`, `supabase/seed.sql`, `supabase/tests/rpc_offers.sql`, `src/server/rpc/offers.ts`, `src/server/rpc/offers.test.ts`, `src/domain/rpc-contracts.ts`, `docs/contracts/**`, `src/types/database.types.ts` | 999, 1000 y 1001 con el piso cambiado a 1500; pending, rejected y suspended rechazados; oferta activa duplicada; limita ofertas exitosas por ventana (tope de ventana verificado y upsert atómico sobre la PK); test de contrato contra `rpc-contracts.ts` y el fake |
| T-102 | P1 | `accept_offer` atómica e idempotente | T-101 | idem + `supabase/tests/rpc_accept.sql` | 10 llamadas concurrentes → una sola ganadora; idempotencia; `ALREADY_MATCHED`; repartidor suspendido entre la oferta y la aceptación |
| T-103 | P1 | Ciclo de solicitud (publish, cancel, picked_up, delivered, no_show, courier_cancel, republish, report_incident), expiración perezosa, distancia por zonas | contracts-v1 | `supabase/migrations/**`, `supabase/tests/rpc_requests.sql`, `src/server/rpc/requests.ts` | Cada transición de §5.1 del master plan, válida e inválida por actor; una solicitud vencida rechaza ofertas; suscripción vencida bloquea publicar; test de contrato |
| T-104 | P1 | `/api/cron/sweep` (expiraciones, purga de documentos, suscripciones vencidas) y `/api/health` | T-103 | `src/app/api/cron/**`, `src/app/api/health/**`, `src/server/**` | Documento vencido purgado y auditado; sin `CRON_SECRET` responde 401 |
| T-105 | P1 | `admin_decide_courier`, `admin_suspend_courier`, `admin_verify_document`, `admin_set_subscription`, `admin_update_setting` | contracts-v1 | `supabase/migrations/**`, `supabase/tests/rpc_admin.sql`, `src/server/rpc/admin.ts` | Caso feliz, sin aal2, rol incorrecto, estado incorrecto; suspender retira las ofertas pending; test de contrato |
| T-106 | P1 | Migración, RLS de coordenadas (`merchants.default_pickup_lat/lng`, `delivery_request_contacts.pickup/dropoff_lat/lng`, `delivery_requests.route_distance_m`), RPC `calculate_route_distance(lat1, lng1, lat2, lng2)` con Haversine × 1.30 y redondeo a 0,5 km, validación de bounding box de Aguilares (-27.4550 a -27.4100 lat, -65.6400 a -65.5950 lng) y fallback a centroides de `zones` | contracts-v1 | `supabase/migrations/**`, `supabase/tests/rpc_distance.sql`, `supabase/tests/rls_coordinates.sql`, `src/server/rpc/distance.ts`, `src/types/database.types.ts` | pgTAP de RLS (repartidor no aceptado recibe NULL al leer coordenadas); un repartidor aprobado no lee `notes`, `paid_until` ni `subscription_status` de `merchants` (PR56-H13); cálculo exacto con factor 1.30 y redondeo a múltiplos de 500 m; coordenadas fuera de Aguilares rechazadas con error P0001; fallback a centroides probado sin lat/lng; tipos regenerados sin diff |
| T-111 | P2 | Alta de comercio (negocio, retiro habitual, pin opcional en mapa de Aguilares con fallback a texto, consentimientos versionados) | T-009 | `src/features/merchants/**`, `src/app/(merchant)/onboarding/**` | Test de la action (mapeo de errores); el comercio queda en `pilot`; versión de consentimiento guardada; coordenadas validadas en Zod dentro de Aguilares |
| T-112 | P2 | Crear solicitud (barrios, direcciones, pin de entrega opcional en mapa de Aguilares con fallback a centroide de `zones`, retiro precargado del comercio editable, selector de cambio en efectivo con chips rápidos "Paga con: $ 2.000 / $ 5.000 / $ 10.000", destinatario con declaración, paquete tipificado en enum `['sobre', 'chico', 'mediano', 'grande']`, indicaciones, medio de pago del destinatario) | T-009 (T-103 o fake) | `src/features/requests/**`, `src/app/(merchant)/requests/new/**` | Tests del schema y de la action; contactos y coordenadas opcionales en `delivery_request_contacts`; cálculo de distancia en servidor invocado (con coordenadas o centroide de zona); chips de cambio guardan `cash_change_amount`; bloqueo sin piloto ni suscripción |
| T-113 | P2 | Mis solicitudes, ofertas en tiempo real (orden por `doc_level` o por precio, insignias de documentación verificada; sin estrellas ni calificaciones de Stitch según S4), aceptar con modal de confirmación y desglose de tarifa y medio de pago | T-112, T-102 | `src/features/requests/**`, `src/features/offers/**`, `src/app/(merchant)/requests/**` | Test de la action de aceptar, incluido `ALREADY_MATCHED`; la oferta nueva aparece sin recargar; verificación de ausencia total de estrellas/reviews ("4.9 ★ 182 viajes") |
| T-114 | P2 | Panel del repartidor: disponibilidad, lista única sin contactos ni mapa (solo barrio de retiro, barrio de entrega y distancia aproximada redondeada; D3/D15; restringido a Aguilares, sin ciudades de prueba de Stitch), tarjetas con piso 14px e indicador visual de necesidad de cambio, ofertar con piso visible (ofertas libres >= $1.000, sin "precio sugerido" de Stitch), retirar, mis ofertas, pantalla "en revisión" | T-009, T-101 (o fake) | `src/features/availability/**`, `src/features/offers/**`, `src/app/(courier)/**` salvo `onboarding/` | Tests de las actions; un pending ve "en revisión"; una oferta bajo el piso muestra el error del servidor; se valida que no viajen coordenadas ni mapa en el DOM ni en la red; sin textos de precio sugerido |
| T-115 | P2 | Vista de viaje: contactos tras aceptar, foto/nombre/vehículo, WhatsApp comercio↔repartidor y "Avisar a mi cliente", retirado/entregado, cancelar, no llegó, republicar | T-103, T-113 | `src/features/trips/**`, `src/app/(merchant)/trips/**`, `src/app/(courier)/trips/**`, `src/lib/whatsapp.ts` | Unit de los mensajes (monto aceptado, sin datos de más); tests de actions por transición |
| T-116 | P2 | Componente de mapa `src/ui/map.tsx` (Google Maps Platform con `@vis.gl/react-google-maps` en import dinámico con `Skeleton`), selector interactivo de pin (crosshair central fijo desplazable, botón "Usar mi ubicación", botones de ajuste fino) para alta de comercio (T-111) y creación de solicitud (T-112), validación Zod de bounding box de Aguilares, y fallback graceful a formulario de texto si la API no carga o está offline | T-008, T-111, T-112, T-106 | `src/ui/map.tsx`, `src/features/merchants/**`, `src/features/requests/**`, `src/app/(merchant)/**` | Tests unitarios de `src/ui/map.tsx` (renderiza fallback si google falla o no hay API key); selección de pin actualiza coordenadas y dirección; Zod rechaza coordenadas fuera de Aguilares; axe AA sin violaciones; first-load bundle JS < 180 KB respetado mediante import dinámico |
| T-117 | P2 | Mapa de recorrido y botón "Abrir en Google Maps" en vista de viaje (T-115, C06, R07): renderizado interactivo de ruta orientativa entre retiro y entrega revelados ÚNICAMENTE tras la aceptación de la oferta, botón de navegación externa (`https://www.google.com/maps/dir/`), y verificación de que el feed de repartidor (T-114, R04, R05) no contenga mapas ni coordenadas (D3/D15) | T-115, T-106, T-116 | `src/features/trips/**`, `src/features/offers/**`, `src/app/(courier)/**`, `src/app/(merchant)/trips/**` | Test de integración: el feed del repartidor no monta mapa ni filtra coordenadas; la vista de viaje renderiza los dos pines tras matched; el botón "Abrir en Google Maps" genera la URL canónica con `encodeURIComponent`; con mapa caído, el botón externo y las direcciones en texto siguen 100% operativos |
| T-121 | P3 | Onboarding del repartidor: DNI, selfie, avatar, vehículo, licencia y seguro opcionales, consentimientos, compresión, progreso y reintento, `dni_hmac` | T-009, T-008 | `src/features/courier-onboarding/**`, `src/app/(courier)/onboarding/**` (visto bueno P2), `src/lib/image-compression.ts` (visto bueno P2) | Unit de compresión; la subida resiste un corte de red; DNI de un rechazado bloqueado |
| T-122 | P3 | Admin de repartidores: MFA obligatorio, cola, visor de documentos auditado, aprobar/rechazar/suspender, verificar licencia y seguro | T-121, T-105, T-008 | `src/features/admin/**`, `src/app/(admin)/couriers/**` | Sin aal2 no se entra; cada vista de documento crea una fila en `audit_log`; tests de actions |
| T-123 | P3 | Admin de comercios y plataforma: tabla de comercios sin CUIT (dato fantasma de Stitch extirpado), TopNav institucional blanco con `<BrandLogo variant="horizontal-color" />` y sin solapa "Liquidaciones" (D14), piloto, pago manual y `paid_until`, settings (piso, TTL, gracia, versión de términos) | T-105, T-008 | `src/features/admin/**`, `src/app/(admin)/merchants/**`, `src/app/(admin)/settings/**` | Cambios auditados; tests de actions; sin campo CUIT en vistas ni en types del admin; sin ruta ni vista de liquidaciones en el bundle |
| T-124 | P3 | Incidentes: botón en el viaje, bandeja admin, resolución y suspensión cautelar | T-103, T-105, T-115, T-008 | `src/features/incidents/**`, `src/app/(admin)/incidents/**`, botón en `src/app/(merchant)/trips/**` y `src/app/(courier)/trips/**` (visto bueno P2) | El reporte llega al admin; la suspensión cautelar es inmediata |

### Fase 2 — PWA, notificaciones y accesibilidad

| ID | Quién | Tarea | Depende de | Archivos permitidos | DoD específico |
|---|---|---|---|---|---|
| T-201 | P3 | Manifest, íconos maskable, service worker (shell offline, caché de lectura), onboarding de instalación en iOS | T-000 | `public/**`, `src/app/manifest.ts`, `src/app/sw.ts` (o equivalente), `src/features/notifications/install/**` | Instalable en Chrome Android; offline muestra el shell y un aviso |
| T-202 | P3 | Cliente de push: permiso desde un gesto, alta y baja de la suscripción, handlers `push` y `notificationclick` | T-201, T-203 | `src/features/notifications/**` | Con el permiso denegado el flujo no se rompe; el click abre la pantalla correcta |
| T-203 | P1 | Emisor de push (fallo del Juez de revision-1) | T-103 | `src/server/push/**`, `src/app/api/push/**`, `supabase/migrations/**` | El payload no lleva datos personales; una falla del emisor no revierte la transición; un 410 borra la suscripción |
| T-204 | P2 | Datos en vivo con TanStack Query (`query-keys.ts` por feature, datos iniciales del servidor, `refetchOnWindowFocus` y `refetchOnReconnect`), invalidación por Supabase Realtime (un canal por pantalla, con debounce), polling de 30 s solo en pantallas activas, badges | T-113, T-114 | `src/features/{requests,offers,trips}/hooks/**`, `src/features/{requests,offers,trips}/query-keys.ts`, `src/lib/hooks/use-realtime-invalidation.ts` | Con el push apagado, la oferta nueva aparece al volver a la app; al desmontar la pantalla se cierra el canal; Realtime no escribe la caché a mano |
| T-205 | P2 | Pasada de accesibilidad y rendimiento en las pantallas de comercio y repartidor | T-115, T-204 | features de P2, `src/ui/**` | axe AA sin violaciones; objetivos de 48 px; `inputmode` numérico; Lighthouse móvil ≥ 80 en rendimiento y ≥ 95 en accesibilidad en crear solicitud, detalle con ofertas, lista del repartidor y viaje; first-load JS dentro del presupuesto de la regla 25 |

### Fase 3 — Calidad, operación y salida

| ID | Quién | Tarea | Depende de | Archivos permitidos | DoD específico |
|---|---|---|---|---|---|
| T-301 | P3 | Arnés E2E: Playwright (con `reducedMotion: 'reduce'`), fixtures por rol, seed y limpieza en staging, page objects, proyecto `global-settings`, `e2e-staging.yml` | T-003 y Fase 1 | `e2e/**`, `playwright.config.ts`, `.github/workflows/e2e-staging.yml` | Un spec de humo corre en CI; dos corridas no se superponen; un helper espera a que desaparezcan los skeletons en lugar de usar tiempos fijos |
| T-302 | P3 | E2E de onboarding del repartidor, aprobación con MFA y DNI duplicado | T-301, T-122 | `e2e/specs/courier-onboarding.spec.ts` | Falla si se quita el chequeo de MFA o la deduplicación |
| T-303 | P2 | E2E del flujo principal: publicar, ofertar (piso), retirar, aceptar en dos pestañas, revelación progresiva, orden por documentación, medio de pago y "Avisar a mi cliente" | T-301, T-115 | `e2e/specs/main-flow.spec.ts` | Falla si el repartidor no aceptado ve el teléfono o si se aceptan dos ofertas |
| T-304 | P2 | E2E de estados: cancelaciones por actor y estado, no llegó y republicar, expiración, entregado | T-301, T-115 | `e2e/specs/request-states.spec.ts` | Cubre cada fila de §5.1; falla si se permite cancelar después de entregado |
| T-305 | P3 | E2E de autorización | T-301, T-122 | `e2e/specs/authorization.spec.ts` | Un pending recibe el error del servidor aunque fuerce la llamada; un suspendido pierde sus ofertas pending al instante; merchant en `(courier)` y courier en `(admin)` son redirigidos; falla al desactivar el chequeo de `submit_offer` o la guarda |
| T-306 | P3 | E2E de piloto y suscripción (proyecto `global-settings`) | T-301, T-123 | `e2e/specs/subscription.spec.ts` | Con el piloto apagado y `paid_until` vencido no se publica; con el piloto encendido o `paid_until` futuro sí; los settings se restauran; falla al quitar el chequeo de `publish_request` |
| T-307 | P2 | E2E de notificaciones y resiliencia | T-301, T-204, T-202 | `e2e/specs/notifications.spec.ts` | Con el permiso denegado la oferta aparece por tiempo real; offline muestra un aviso y al reconectar refresca sin perder el formulario; falla si se quita el refetch |
| T-308 | P3 | E2E de incidentes y suspensión cautelar | T-301, T-124 | `e2e/specs/incidents.spec.ts` | El reporte llega a la bandeja; el suspendido no oferta ni puede ser aceptado; falla si `accept_offer` no revalida |
| T-309 | P3 | E2E de carga de documentos con red lenta y accesibilidad | T-301, T-121 | `e2e/specs/uploads-a11y.spec.ts` | Con red 3G simulada y un corte, la carga se completa al reintentar; el servidor rechaza un archivo inválido; axe AA en login, crear solicitud, lista del repartidor, viaje y onboarding |
| T-310 | P1 | Backups y PITR, bucket de documentos fuera del backup, simulacro de restauración en staging, Sentry sin datos personales, uptime y alertas | T-104, T-007 | `docs/adr/**`, `docs/runbooks/**`, `src/server/observability/**` | Acta del simulacro; alerta de prueba recibida |
| T-311 | P3 | Páginas legales y consentimientos versionados | T-111, T-121 | `src/features/legal/**`, `src/app/(public)/legal/**` | Textos revisados por un abogado (bloqueante externo); versión aceptada registrada |
| T-312 | Todos | Checklist de release `staging → main` | T-302…T-311, T-313, T-314 | `docs/runbooks/release.md` | E2E completo verde; migraciones aplicadas; variables de producción; nota de rollback; abogado OK; simulacro OK; **revisión de seguridad independiente** de `supabase/migrations` y `src/server` (rol security de El Consejo sobre el diff acumulado, porque no hay un segundo experto); **aprobación de Lautaro073** |
| T-313 | P2 | E2E de registro de comercio y consentimientos | T-301, T-111 | `e2e/specs/merchant-registration.spec.ts` (visto bueno P3) | Alta completa y panel visible; versión de consentimiento registrada; un courier no entra a `(merchant)`; falla si no se guarda el consentimiento |
| T-314 | P3 | E2E de mapas, geolocalización, privacidad (D3/D15) y degradación graceful (mock Google Maps) | T-301, T-106, T-116, T-117 | `e2e/specs/map-privacy.spec.ts` | Playwright mockea Maps API (0 llamadas a Google); valida que el feed abierto no tenga tags con coordenadas; valida selección de pin en alta y solicitud; valida error inline con pin fuera de Aguilares; valida que tras matched aparezca el mapa y botón Google Maps; valida degradación cuando Maps falla |

## 9. Prompts para agy

```text
Nueva tarea:  Tomá T-xxx de cadeApp con la skill tomar-tarea. Cumplí AGENTS.md y .agents/rules. Tocá solo los
              archivos permitidos de la ficha. Escribí primero las pruebas del DoD y mostrá que fallan.
Continuar:    Retomá T-xxx con la skill retomar-tarea. Antes de cambiar nada mostrame el estado de los checks y
              qué dice la última entrada de la bitácora.
Terminar día: Cerrá la sesión de T-xxx con la skill cerrar-sesion.
Contrato:     El contrato no alcanza para T-xxx. Usá la skill contract-change y no sigas con la tarea.
Revisar PR:   Revisá el PR de T-xxx con la skill revisar-pr y dame el informe para pegar en el PR.
              No apruebes ni mergees.
Sin cuota:    (a mano) git add -A && git commit -m "wip(T-xxx): corte por cuota" && git push, más una línea en la bitácora.
```

## 10. Matriz requisito → tarea → prueba

| Requisito | Tarea | Prueba |
|---|---|---|
| El plan de implementación corregido permite que 3 personas, cada una con agy, construyan el MVP de cadeApp en simultáneo sobre GitHub (develop, staging y main) con tareas divididas por persona que no se pisan, que cualquiera pueda continuar el trabajo en distintos momentos gracias a reglas de coordinación explícitas para humanos y agentes, y que el código cumpla reglas claras de calidad, modularización, seguridad y pruebas alineadas con el master plan. | §2, §3, §5 a §8 completos (T-000 a T-314) | T-001 (guard, CODEOWNERS, simulacro de traspaso), T-003 (CI y protecciones), suite E2E T-301 a T-314 y checklist T-312 aprobados |
| Tareas divididas por persona para trabajo simultáneo | §7 tableros, §8 archivos permitidos, zonas §2 | Tableros sin tareas huérfanas (verificado); ningún PR mergeado toca archivos fuera de su ficha (informe `revisar-pr` + revisión de Lautaro073) |
| Un solo experto revisando con seguridad | §2 aprobaciones, §3.8 guía, skill `revisar-pr`, `approval-policy`, revisión de seguridad independiente en T-312 | `approval-policy` bloquea los PR de prueba (T-003); informe de seguridad adjunto en T-312 |
| Cualquiera continúa el trabajo en otro momento | Skills `retomar-tarea` y `cerrar-sesion`, bitácora, PR en Draft (§3.2-3.3) | Simulacro de traspaso en T-001 con acta en la bitácora |
| Sin pisarse en archivos compartidos y migraciones | §3.4, wrappers de RPC por dominio, `concurrency` en `migrate.yml` | Dos merges de migración seguidos no corren en paralelo (T-003); lockfile según la regla 50 |
| Contratos estables y cambios controlados | `contracts-v1`, skill y plantilla de contract-change (§3.5) | Test de contrato RPC ↔ `rpc-contracts.ts` ↔ fake en T-101 a T-105 |
| Buen código y modularización | Reglas 10 y 20, ESLint de fronteras, `server-only` | Fixtures de lint que fallan (T-000); build roto al importar `server-only` desde cliente |
| Seguridad con agentes | Regla 00, hook `agent-guard`, sin credenciales remotas en laptops, Code Owners, Actions por SHA, `pnpm audit`, `rls_enabled.sql` | 35 casos del guard (hechos) + prueba en agy (T-001); `rls_enabled.sql` demostrado fallando (T-005) |
| Selección de pin en mapa de Aguilares, distancia calculada en servidor y recorrido post-aceptación (D15) | T-106, T-116, T-117, T-314 | pgTAP de RLS de coordenadas (repartidor no aceptado recibe NULL); unitarias de bounding box y Haversine × 1.30; E2E T-314 con mock de Google Maps validando que en el feed no viajan coordenadas, revelación tras matched y degradación graceful a texto |
| Sistema de diseño, tokens shadcn/ui y estrategia de logos (D16) | T-008, T-111 a T-115, T-121 a T-124 | Verificación de tokens HSL, contraste >= 4.5:1 (AAA 6.93:1 en botones primarios), piso tipográfico 14px (Anti-12px), logos optimizados en `public/brand/` (< 5 KB), manifest PWA con PNGs y ausencia de datos fantasma de Stitch en tests unitarios y de integración |
| Pruebas que prueban | Regla 40, DoD específico por tarea, umbral de cobertura en `domain` | Cada ficha registra en la bitácora la prueba demostrada fallando; CI con umbral de cobertura |
| E2E de todos los flujos (D10) | T-301 a T-309, T-313 y T-314 | `e2e-staging` verde como check obligatorio de `main` |
| Producción controlada | Solo Lautaro073 en `production` y en `staging → main` | Environment `production` con required reviewer (T-003) |

## 11. Decisiones, cambios, disensos y supuestos

### 11.1 Decisiones humanas (checkpoint revision-2, Lautaro073, 2026-09-17)
- Se aprueban: el protocolo para retomar tareas, los controles técnicos en agy y GitHub, la regla de que lo que lee el agente es dato, y el E2E de registro de comercio.
- Contratos: contract-change sin ganador por defecto; se escala a Lautaro073 si toca D1–D14.
- Producción: una sola persona, Lautaro073.
- Respaldo de revisión en todas las zonas: Lautaro073.
- **Composición real del equipo (posterior al checkpoint):**
  - Lautaro073 es una de las 3 personas y la única con experiencia. Toma P1 (datos y servidor) más el arranque (T-000, T-001, T-003).
  - Las otras dos personas operan agy en P2 y P3, cada una con su propia cuenta de agy y de GitHub.
  - Los PR de P2 y P3 los aprueba Lautaro073; los de Lautaro073, P2 o P3 con informe de agy (§2).
- Ejecución: solo los roles necesarios (PM, Documentación, Frontend, Backend, QA, Seguridad, DevOps y Juez); PM y Documentación por agy con el plan en partes.

### 11.2 Fallos del Juez (técnicos, reversibles)
- `codeowners-spof-p1`: se mantiene `concurrency` en `migrate.yml`. **Reabierto por su condición (a):** con Lautaro073 como P1 no hay una segunda persona con experiencia en base, así que no hay respaldo ni procedimiento de emergencia. Si Lautaro no está, los cambios de base esperan.
- `conf-auth-scope-p2-p3`: `auth` pasa a P2 con la nueva T-009; T-111 y T-121 dependen de ella; el onboarding del repartidor queda en `(courier)`. Sigue vigente.
- `rebalance-fase3-p1-e2e`: **Reabierto por su condición (b):** P1 ya no tiene capacidad libre, porque suma el arranque y todas las revisiones. T-305 y T-306 vuelven a P3, que dejó T-000, T-001 y T-003. Se aplica el mismo criterio del fallo: las suites van a quien tiene capacidad en el camino crítico.
- `conf-codeowners-routegroup-p2-p3`: se mantiene que las rutas de otra zona se nombran por subruta. La revisión del dueño de zona pasa a ser un visto bueno de coordinación, porque la aprobación la centraliza §2.

### 11.3 Cambios respecto de v1
1. Tableros por persona (§7) y protocolo asincrónico completo (§3): Project, PR en Draft, bitácora, traspasos, esperas, Día 0.
2. Nuevas tareas: T-009 (auth base), T-105 (RPC de admin) y T-313 (E2E de registro de comercio). T-305 y T-306 pasan a P1.
3. Kit de agy como archivos reales:
   - la regla 00 de confianza;
   - las skills `retomar-tarea`, `cerrar-sesion` y `contract-change`;
   - el hook `agent-guard` probado;
   - las plantillas de bitácora y CC, y el onboarding.
4. Dueños definidos para `auth`, `lib`, los archivos raíz, `package.json` y el lockfile, y regla para los conflictos del lockfile.
5. CI: jobs paralelos con caché, umbral de cobertura, `pnpm audit`, Actions por SHA, `rls_enabled.sql`, `concurrency` en migraciones y E2E, proyecto `global-settings`.
6. Versiones fijadas (Node, pnpm vía Corepack, CLI de Supabase) y `docs/onboarding.md`.
7. Release semanal con capitán rotativo, reglas de hotfix con migración, y producción controlada por Lautaro073.
8. DoD específico en las tareas de Fase 1 de P2 (tests de actions) y en T-305 a T-309.
9. Reglas técnicas nuevas: `rate_limits` atómico, trigger de alta que nunca asigna admin, `server-only`, wrappers de RPC por dominio, fake de RPC con test de contrato.
10. Hasta que T-003 esté mergeada, cada PR lleva los checks locales pegados y se aprueba según §2.
11. **Ajuste por el equipo real (v2.1):**
    - Lautaro073 toma P1 más T-000, T-001 y T-003;
    - T-305 y T-306 pasan a P3;
    - aprobaciones centralizadas (§2) con el check `approval-policy` y la skill `revisar-pr`;
    - guía para quienes tienen menos experiencia (§3.8);
    - sin procedimiento de emergencia;
    - revisión de seguridad independiente antes del release (T-312).
12. **Stack y patrones (v2.2, ensamblado; no revisado por el Consejo):**
    - regla 25: dependencias aprobadas, nombres, reutilización, árbol de decisión de estado, Zod como fuente de verdad, rendimiento con presupuestos y escalado;
    - shadcn/ui + Tailwind en `src/ui` con tokens, `Skeleton` para cargas, Sonner para avisos y Motion para animaciones (preferencias de Lautaro073), react-hook-form, TanStack Query para datos en vivo;
    - `src/features/_template/`, validación de variables de entorno con Zod;
    - skill `implementar-diseno` y §12 para trabajar con Stitch;
    - T-000, T-003, T-008, T-204 y T-205 ajustadas.
13. **Infraestructura Free Tier y operadores no-técnicos (v2.3, Lautaro073, 2026-09-17):**
    - Se confirma el supuesto S3 del master plan: 2 proyectos Supabase remotos en el Free Tier (`staging` y `producción`). `develop` opera sin base remota, usando Docker local para devs y en runners de GitHub para CI (costo $0, sin colisiones de datos).
    - Se formaliza que P2 y P3 no programan: agy codifica y se autoinstruye a través de fichas y skills (`tomar-tarea`, `retomar-tarea`, `cerrar-sesion`, `revisar-pr`), con Lautaro073 como único líder técnico y revisor humano.
14. **Geolocalización, selección de pin en mapa de Aguilares y distancia en servidor (v2.4, D15, 2026-09-18):**
    - Se incorpora la selección de pin en mapa para retiro y entrega en mapa de Aguilares mediante `@vis.gl/react-google-maps` cargado dinámicamente (`src/ui/map.tsx`).
    - Cálculo server-side de distancia con fórmula Haversine × 1.30 (redondeada a 0,5 km) en Postgres; centroides de `zones` como fallback.
    - Preservación estricta de D3: antes de ofertar, el repartidor ve solo los barrios y la distancia aproximada (sin mapa ni coordenadas). Tras aceptar, ve el mapa con recorrido orientativo y el botón "Abrir en Google Maps".
    - Ratificación de D7: sin tracking en vivo ni GPS del repartidor.
    - Tareas nuevas agregadas: T-106 (P1), T-116 (P2), T-117 (P2) y T-314 (P3).
15. **Sistema de diseño unificado, tokens shadcn/ui y auditoría de Stitch (v2.5, D16, 2026-09-18):**
    - Se incorporan las 36 vistas exportadas y organizadas en `docs/design/stitch/exports/` (`A00/`, `P00/`, `C00/`, `R00/`, `T00/`, `S00/`), acompañadas de sus 6 especificaciones técnicas `README.md` vinculantes con el dictamen de El Consejo.
    - Se congelan los tokens semánticos en `src/ui/tokens.css` mapeados a shadcn/ui (`--primary: #09BABD`, `--primary-foreground: #12182C` con contraste 6.93:1 WCAG AAA, `--background: #FDFCFB`, `--card: #FFFFFF`, `--border: #E4E7EC`, `--muted-foreground: #5B6475`, radio 10px).
    - Se adopta la estrategia de logos: los SVGs/PNGs de `assets/` son archivos fuente maestros de Canva con metadatos C2PA y PNGs embebidos; la app productiva no importa de `assets/`, sino de versiones vectoriales optimizadas (< 5 KB) y WebP en `public/brand/` a través de `<BrandLogo />` (`2.svg` para TopBar marino, `3.svg` para Admin blanco, `4.svg` para Splash/Hero, `1.svg` para tickets POS; PNGs rasterizados obligatorios para el manifest de la PWA).
    - Cláusula Anti-12px: piso tipográfico mínimo de 14px (`text-sm` Inter 500/600) para asegurar legibilidad en exteriores bajo la luz solar de Aguilares.
    - TopBar marino unificado (56px `#12182C`) y BottomNav fija con targets táctiles ≥ 48px para navegación móvil en comercios y repartidores.
    - Extirpación de 7 datos fantasma generados por Stitch: eliminación de estrellas y contadores de viajes (S4), precios sugeridos en ofertas, CUIT en comercios, pestaña "Liquidaciones" en Admin (D14), facturación AFIP/ARBA (D6), localidades foráneas ajenas a Aguilares (D13) y bultos no tipificados.
    - Refinamientos operativos: pin de entrega en C03 opcional (con centroide como fallback en hora pico) y selector rápido de cambio en efectivo ("Paga con: $ 2.000 / $ 5.000 / $ 10.000") visible en R07.
    - Tareas actualizadas con estos requerimientos: T-008, T-112, T-113, T-114, T-123.

### 11.4 Disensos preservados
- **Un solo experto.** Backend, DevOps y PM pedían que la revisión no dependiera de una persona. Con el equipo real, Lautaro073 programa la zona más crítica, aprueba todos los PR de P2 y P3 y administra producción.
  - Riesgo 1: cuello de botella y parálisis de la base si Lautaro no está.
  - Riesgo 2: los PR de Lautaro073 no tienen revisión humana experta; la cubren CI, el informe de agy y la revisión de seguridad de T-312.
  - Se reabre si los PR esperan más de 1 día hábil o si entra una persona con experiencia.
- **Alcance del respaldo.** Backend quería un CODEOWNER pleno y DevOps solo de emergencia. Con el equipo real no hay respaldo experto (fallo reabierto).
- **`auth` y onboarding.** Frontend proponía `auth` para P3 y el onboarding en `(public)`; se descartó. Backend proponía que T-121 dependiera de T-111; también se descartó.
- **E2E de autorización y suscripción.** Backend prefería que P1 aportara las aserciones en pareja. Con P1 sin capacidad, las escribe P3 y Lautaro073 las revisa al aprobar.
- **Hook de agy.** El control es real pero cada persona lo puede desactivar en su máquina. La barrera dura es que no haya credenciales remotas en las laptops.
- **Ejecución.** La réplica de PM por agy fue sin el plan (compactación de nivel 3) y DevOps y Frontend replicaron en un segundo intento tras un corte por límite de uso. Ver la evidencia.

### 11.5 Supuestos a verificar (reversibles)
| # | Supuesto | Se verifica en |
|---|---|---|
| A1 | CODEOWNERS acepta rutas con paréntesis (`(admin)`) y manda la última línea que coincide | T-001 |
| A2 | GitHub no deja aprobar el propio PR, y un workflow puede leer las aprobaciones de un PR y la sección del informe para hacer cumplir `approval-policy` | T-003 |
| A3 | En `hooks.json` de agy, el comando corre desde `.agents/`, `run_command` trae `CommandLine` y `"ask"` respeta los permisos normales | T-001 (prueba en agy) |
| A4 | `concurrency` con `cancel-in-progress: false` no pierde migraciones (`db push` aplica todas las pendientes) | T-003 |
| A5 | La CLI de Supabase como devDependency fija la versión de las imágenes locales | T-002 |
| A6 | El umbral inicial de cobertura (90 % de ramas en `domain`) es alcanzable sin tests vacíos | T-006 |
| A7 | El release semanal alcanza para el ritmo del equipo | Primer mes |

## 12. Diseño cerrado (D16), tokens shadcn/ui y especificaciones de Stitch

El diseño visual de cadeApp quedó **cerrado y formalizado mediante la resolución D16** tras la auditoría integral de El Consejo (`revision-3`) sobre las 36 vistas generadas en Stitch. Los mockups de Stitch sirven como referencia de estructura y disposición, mientras que el código en producción implementa componentes desacoplados en `src/ui/` gobernados por tokens CSS semánticos y reglas de ergonomía bajo luz solar.

### 12.1 Tokens canónicos shadcn/ui (`src/ui/tokens.css`)

El kit de diseño se integra nativamente con **Tailwind CSS + shadcn/ui** a través de variables CSS semánticas. Toda la UI utiliza la paleta oficial institucional garantizando accesibilidad WCAG AAA en interacciones principales:

| Token / Variable CSS | Valor Hex / HSL | Rol semántico | Accesibilidad / Ratio |
|---|---|---|---|
| `--primary` | `#09BABD` (`hsl(181, 91%, 39%)`) | Botones primarios, acentos activos, badges | Fondo activo |
| `--primary-foreground` | `#12182C` (`hsl(225, 42%, 12%)`) | Texto e íconos sobre botón primario | **6.93:1 (WCAG AAA)** |
| `--background` | `#FDFCFB` (`hsl(30, 20%, 99%)`) | Fondo general de la aplicación | Confort visual en exteriores |
| `--card` / `--popover` | `#FFFFFF` (`hsl(0, 0%, 100%)`) | Fondo de tarjetas elevadas y modales | Superficie neutra pura |
| `--card-foreground` | `#12182C` (`hsl(225, 42%, 12%)`) | Títulos, precios y etiquetas principales | Máximo contraste |
| `--muted-foreground` | `#5B6475` (`hsl(220, 13%, 41%)`) | Textos secundarios, timestamps y ayudas | 4.85:1 (WCAG AA) |
| `--border` / `--input` | `#E4E7EC` (`hsl(216, 16%, 91%)`) | Separadores, bordes de inputs y cards | Contorno sutil definido |
| `--secondary` | `#0B7A7D` (`hsl(182, 84%, 27%)`) | Hover de primarios y estados secundarios | Alto contraste sobre blanco |
| `--radius` | `0.625rem` (10px) | Inputs y botones; tarjetas en `0.75rem` (12px) | Geometría consistente |

### 12.2 Cláusula Anti-12px (Ergonomía bajo luz solar)

> [!IMPORTANT]
> **Piso tipográfico mínimo obligatorio:** Queda **estrictamente prohibido** el uso de fuentes de 11px o 12px en cualquier pantalla móvil de comercio o repartidor. Stitch generó más de 200 ocurrencias en estos tamaños que resultan ilegibles para un repartidor conduciendo bajo el sol de Aguilares.
> - **Piso absoluto en móvil:** `text-sm` (14px, mínimo 13.5px para badges muy compactos), con peso `font-medium` (500) o `font-semibold` (600).
> - **Títulos y montos:** Tipografía Montserrat 700 para cifras (`$ 1.500`) y títulos `h1`/`h2`.
> - **Lectura y formularios:** Tipografía Inter 400/500/600 para inputs, etiquetas y párrafos.
> - **Targets táctiles:** Mínimo absoluto de 48px × 48px para todo elemento clickeable en móvil (regla 60).

### 12.3 TopBar y BottomNav unificados

A fin de eliminar la fragmentación entre las vistas generadas individualmente en Stitch:
1. **TopBar Marino Institucional (56px `#12182C`):** Cabecera unificada para todas las pantallas móviles de comercio (`(merchant)`) y repartidor (`(courier)`). Incluye `<BrandLogo variant="horizontal-white" />` (o isotipo en pantallas de subnivel), título de sección en blanco y botón de perfil o estado.
2. **TopNav Admin Web (64px `#FFFFFF`):** Barra superior de escritorio con borde `#E4E7EC`, `<BrandLogo variant="horizontal-color" />`, enlaces de navegación (`Postulantes`, `Comercios`, `Parámetros`, `Incidentes`) y avatar de administrador.
3. **BottomNav Fija Móvil:** Barra inferior fija con soporte para `safe-area-inset-bottom`, 3 a 4 accesos directos con targets táctiles ≥ 48px y badges numéricos dinámicos vinculados a TanStack Query.

### 12.4 Taxonomía y pipeline de logos (`<BrandLogo />`)

Los archivos en `assets/` provienen de exportaciones de Canva AI y pesan entre 226 KB y 1.29 MB al contener imágenes Base64 embebidas y manifiestos C2PA. **No deben importarse directamente al bundle de JavaScript de cliente.**

La implementación productiva utiliza el componente `<BrandLogo />` ubicado en [src/ui/brand-logo.tsx](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/src/ui/brand-logo.tsx) alimentado desde `public/brand/`:

| Archivo en `assets/` | Variante en `<BrandLogo />` | Destino en `public/brand/` | Uso en la aplicación |
|---|---|---|---|
| `2.svg` (Horizontal blanco) | `<BrandLogo variant="horizontal-white" />` | `public/brand/logo-horizontal-white.svg` (< 5 KB) | TopBar marino móvil (56px `#12182C`) |
| `3.svg` (Horizontal azul) | `<BrandLogo variant="horizontal-color" />` | `public/brand/logo-horizontal-color.svg` (< 5 KB) | TopNav Admin web, landings públicas claras |
| `4.svg` (Isotipo / Símbolo) | `<BrandLogo variant="symbol" />` | `public/brand/symbol.svg` (< 3 KB) | Favicon, splash screen, avatares por defecto |
| `1.svg` (Monocromático) | `<BrandLogo variant="monochrome" />` | `public/brand/logo-mono.svg` (< 4 KB) | Impresión térmica de tickets POS, recibos físicos |
| `*.png` (Raster) | Íconos W3C PWA | `public/icon-192.png`, `icon-512.png`, `apple-touch-icon.png` | Manifest PWA (`manifest.ts`) — W3C exige PNGs |

### 12.5 Extirpación de los 7 datos fantasma de Stitch

Los agentes y desarrolladores que implementen pantallas deben **ignorar y eliminar** los siguientes elementos decorativos inventados por la IA de Stitch que contradicen las decisiones de producto:

1. **Estrellas y reseñas de reputación ("4.9 ★ 182 viajes"):** Eliminadas de C05, T05 y tarjetas de oferta. El supuesto S4 congela calificaciones fuera del MVP; la confianza se basa exclusivamente en las insignias de documentación verificada (`doc_level`).
2. **Precio sugerido en ofertas del repartidor (R05):** Eliminado. La oferta es abierta y libre con piso mínimo de $1.000 (D2).
3. **Localidades y barrios ajenos a Aguilares:** Clampeados estrictamente al enum de barrios de Aguilares (D13). Stitch dibujó Yerba Buena, San Miguel de Tucumán, Córdoba y Mendoza.
4. **CUIT en tabla de comercios (A03):** Eliminado del admin. El comercio se registra con nombre del negocio, WhatsApp y dirección; no se solicita CUIT en el MVP.
5. **Solapa "Liquidaciones" en Admin:** Eliminada del TopNav de A00. cadeApp no custodia fondos ni liquida comisiones a repartidores (D14); el cliente paga directamente en destino.
6. **Detalles de facturación ARBA/AFIP (C08):** Eliminados. No hay facturación en el MVP (D6).
7. **Bultos y etiquetas no estándar:** Sanitizados estrictamente al enum de base de datos: `['sobre', 'chico', 'mediano', 'grande']`.

### 12.6 Refinamientos operativos acordados

1. **Pin de entrega en C03 opcional (hora pico):** Para comercios apurados con cola de clientes, marcar el pin en el mapa al crear una solicitud es opcional. Si Don Juan no fija el pin, selecciona el barrio del desplegable e ingresa la dirección en texto; el servidor calcula la distancia usando el centroide de `zones` como fallback automático sin bloquear la publicación.
2. **Chips rápidos para cambio en efectivo:** Al marcar "Necesita cambio" en C03, se despliegan chips de selección rápida ("Paga con: $ 2.000 / $ 5.000 / $ 10.000"), cuyo valor se persiste en `delivery_request_contacts.cash_change_amount` y se visualiza en grande en el viaje activo del repartidor (R07) para evitar desacuerdos al cobrar.

### 12.7 Especificaciones vinculantes por carpeta de exportación

Las 36 vistas generadas en Stitch están archivadas en `docs/design/stitch/exports/` divididas por módulo. Cada carpeta cuenta con un `README.md` técnico que actúa como **contrato de interfaz vinculante** para agy y los colaboradores:

| Carpeta | Vistas | Guía técnica vinculante | Contenido y decisiones de diseño |
|---|:---:|---|---|
| `A00/` | 7 | [`docs/design/stitch/exports/A00/README.md`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/A00/README.md) | Panel Admin desktop: postulantes, visor de documentos auditado, comercios, parámetros e incidentes. TopNav blanco, sin solapa liquidaciones, sin CUIT. |
| `P00/` | 5 | [`docs/design/stitch/exports/P00/README.md`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/P00/README.md) | Vistas públicas: Splash, Landing institucional, Login unificado y registro segmentado con rol. TopBar marino, `<BrandLogo />`, voseo argentino. |
| `C00/` | 8 | [`docs/design/stitch/exports/C00/README.md`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/C00/README.md) | App Comercio: alta con pin de local, lista de solicitudes, crear solicitud con pin opcional y cambio, ofertas en vivo sin estrellas, viaje activo con WhatsApp y mapa. |
| `R00/` | 8 | [`docs/design/stitch/exports/R00/README.md`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/R00/README.md) | App Repartidor: onboarding de documentos, lista abierta (D3/D15: sin mapas ni coordenadas pre-oferta), ofertar sin precio sugerido, viaje activo con Google Maps y cobro. |
| `T00/` | 6 | [`docs/design/stitch/exports/T00/README.md`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/T00/README.md) | Transversales: diálogo de confirmación irreversible, offline graceful (T03), error de red, permiso push, modal de calificación contextual. |
| `S00/` | 2 | [`docs/design/stitch/exports/S00/README.md`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/S00/README.md) | Sistema de diseño fundacional: paleta, tipografía Inter/Montserrat, componentes shadcn/ui y tokens CSS. |
| Índice | 36 | [`docs/design/stitch/exports/registro.md`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/registro.md) | Catálogo completo de pantallas con miniaturas, nombres canónicos, prompts de origen y enlaces directos. |

### 12.8 Protocolo de implementación para agy y operadores

Al tomar cualquier tarea de UI (T-008, T-111 a T-117, T-121 a T-124):
1. **Lectura previa obligatoria:** El agente debe consultar el `README.md` de la carpeta correspondiente en `docs/design/stitch/exports/` antes de escribir código.
2. **Utilizar componentes de `src/ui/`:** No crear elementos HTML crudos con estilos en línea. Usar las primitivas shadcn/ui (`Button`, `Card`, `Input`, `Dialog`, `Skeleton`, etc.).
3. **Respetar tokens semánticos:** Usar clases semánticas de Tailwind (`bg-primary`, `text-primary-foreground`, `border-border`, etc.) mapeadas a `src/ui/tokens.css`.
4. **Respetar el piso de 14px:** Clampear todo texto secundario a `text-sm font-medium`.
5. **No inventar datos fantasma:** Seguir estrictamente la lista de datos extirpados de §12.5.

