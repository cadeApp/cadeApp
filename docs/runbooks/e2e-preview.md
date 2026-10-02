# E2E contra el Vercel Preview de cada PR

## Decisiones P1 (2026-10-02)

- Las PR internas se validan directamente contra su Vercel Preview usando Supabase Develop compartido. Staging
  deja de ser el entorno de iteración por PR y queda reservado para checkpoints/release candidates.
- Vercel despliega develop/previews mediante Git Integration; GitHub Actions no despliega Vercel Develop.
- Las PR con migraciones no aplican schema remotamente a Supabase Develop antes del merge.

`e2e-staging.yml` no cambia: sigue corriendo `smoke` + `main-flow` después del deploy a staging.

## Circuito

```
push a la rama de la PR
  → Vercel (proyecto cadeApp-develop) despliega el Preview
  → Vercel avisa a GitHub con repository_dispatch (vercel.deployment.success / .ready)
  → e2e-preview.yml · resolve-preview: ¿es cadeApp-develop? ¿hay UNA PR interna abierta contra develop
    cuyo head es ese SHA? ¿toca supabase/migrations?
  → e2e-preview.yml · e2e-preview: checkout del SHA, health check, smoke + main-flow con --workers=1
  → commit status `e2e-preview` en el SHA de la PR
```

El run aparece en Actions sobre `develop` (así funciona `repository_dispatch`), no en la pestaña Checks de la
PR. Lo que se ve en la PR es el commit status `e2e-preview`, que enlaza al run.

| Estado de `e2e-preview` | Significado |
|---|---|
| `pending` | Preview listo, E2E en cola o corriendo |
| `success` | `smoke` + `main-flow` verdes contra ese Preview |
| `failure` | Algún spec falló: se corrige la PR |
| `error` · `BLOCKED / REQUIRES DEVELOP MIGRATION` | La PR toca `supabase/migrations/**`: no se corre E2E remoto |
| `error` · `E2E no corrió (...)` | El job se canceló o no arrancó: re-ejecutar el run |
| sin status | No era una PR interna contra develop con ese head, o el deployment era de otro proyecto |

## Por qué `repository_dispatch` y no `deployment_status`

Metadata real del GitHub Deployment que crea Vercel en este repo (deployment `6802523944`): `ref` y `sha` del
commit, `environment`, `payload: {}`, y en el status `environment_url` con la URL única del deployment. No trae
el Project ID de Vercel, así que con ese evento no se puede comprobar a qué proyecto pertenece sin consultar la
API de Vercel con un token.

El `repository_dispatch` de Vercel sí lo trae (`client_payload.project.id`, junto con `git.sha`, `url` e `id`;
esquema en <https://github.com/vercel/repository-dispatch>) y es el mecanismo que Vercel recomienda para E2E
sobre previews. Además GitHub lo ejecuta siempre con el workflow de la rama por defecto: la PR que se está
probando no puede modificar el gate que decide si recibe secretos.

## Controles

- **Proyecto:** `client_payload.project.id` debe ser igual al secreto `VERCEL_PROJECT_ID` del Environment
  `develop`. Un deployment de otro proyecto se ignora; sin el secreto configurado el job falla.
- **SHA exacto:** el SHA del payload se busca en GitHub; tiene que ser el head de exactamente una PR abierta
  contra `develop`. Más de una: falla. El checkout y el status usan ese mismo SHA.
- **Forks:** si el head de la PR no es `cadeApp/cadeApp`, no hay E2E ni secretos. No se usa
  `pull_request_target`.
- **URL:** solo se acepta un origen `https://<algo>.vercel.app` del payload. No hay URL fija ni entrada manual.
- **Secretos:** `environment: develop`. La service role solo existe en el step de Playwright, del lado del
  runner (seed/cleanup); nunca es `NEXT_PUBLIC_*`.
- **Base correcta:** antes de sembrar se exige `NEXT_PUBLIC_SUPABASE_URL == https://<SUPABASE_DEVELOP_PROJECT_REF>.supabase.co`
  y que ese ref sea distinto al de staging (`SUPABASE_PROJECT_REF`).
- **Serialización:** un grupo de `concurrency` fijo, `cadeapp-develop-e2e`, igual para todas las PR, con
  `cancel-in-progress: false`. Ver «Concurrency» más abajo: no es una cola FIFO.
- **Seed/cleanup:** los de T-303 (`e2e/fixtures`, `src/server/e2e/staging-seed.ts`), sin cambios.

## Concurrency (decisión P1 5-A)

GitHub Actions admite, por grupo, **una corrida en ejecución y una pendiente**. `cancel-in-progress: false`
garantiza que la corrida en ejecución nunca se corta. No garantiza nada sobre la pendiente: si llega una tercera
corrida mientras hay una esperando, GitHub cancela la que esperaba y deja la nueva en su lugar.

No se implementa una cola FIFO propia. Lo que sí se garantiza:

- Dos E2E nunca corren a la vez contra Supabase Develop.
- Una corrida reemplazada, cancelada o que no llegó a ejecutarse deja el status `e2e-preview` en `error`
  («E2E no corrió»), nunca en verde.
- Esa corrida se recupera con «Re-run all jobs» sobre el run en Actions: un re-run vuelve a resolver el mismo
  deployment y no se descarta como duplicado.

## Migraciones

- `migrate.yml` corre `migrate-develop` solo por push a `develop` (es decir, después del merge): `supabase db push`
  a Supabase Develop y drift check de tipos, con `environment: develop`.
- Una PR que toca `supabase/migrations/**` se valida con `db-tests` del CI (Supabase local en el runner). Su
  `e2e-preview` queda en `BLOCKED / REQUIRES DEVELOP MIGRATION`; el E2E remoto se hace después del merge.
- `deploy.yml` sigue reaccionando solo a `migrate` de `staging` y `main`.

## Configuración manual

| Dónde | Nombre | Tipo |
|---|---|---|
| GitHub · Environment `develop` | `VERCEL_PROJECT_ID` | secreto (ya existe) |
| GitHub · Environment `develop` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_PASSWORD`, `DNI_HMAC_SECRET`, `CRON_SECRET` | secretos (ya existen) |
| GitHub · repositorio | `SUPABASE_PROJECT_REF` (staging), `SUPABASE_ACCESS_TOKEN` | ya existen |
| Vercel · `cadeApp-develop` | Eventos `repository_dispatch` hacia GitHub | deben estar habilitados (Settings → Git) |

### Requisitos obligatorios antes del merge (los hace P1 a mano)

Nada de esto se configura desde la rama ni por CLI. El merge a `develop` dispara `migrate-develop` en el acto,
así que los puntos 1 a 3 tienen que existir antes de mergear.

1. **Environment `develop` restringido a la rama `develop`.** GitHub → Settings → Environments → `develop` →
   *Deployment branches and tags* → *Selected branches and tags* con una única regla: `develop`. Es un requisito
   de seguridad, no una recomendación: el Environment guarda la service role y la contraseña de la base. Con
   *No restriction*, cualquier workflow escrito en una rama interna puede declarar `environment: develop` y
   recibir esos secretos; que el workflow bueno viva en `develop` no lo impide. `e2e-preview`
   (`repository_dispatch`) y `migrate-develop` (push a `develop`) corren ambos sobre `develop`, así que la regla
   no los afecta.
2. **Variable `SUPABASE_DEVELOP_PROJECT_REF`** (no secreta) en el Environment `develop`, con el ref del proyecto
   Supabase Develop (decisión 2-A). Sin ella `migrate-develop` y `e2e-preview` fallan cerrados antes de tocar
   la base.
3. **`SUPABASE_ACCESS_TOKEN` con acceso al proyecto Supabase Develop.** Es el token de repositorio que ya usa CI;
   si no alcanza a Develop, `supabase link` falla en `migrate-develop`.
4. **Vercel Authentication desactivada solo para Preview** en `cadeApp-develop` (decisión 1-A). Hoy el Preview
   responde 302 a `vercel.com/sso-api` y el health check del gate falla. No se usa bypass secret. Esto no frena
   el merge, pero sin eso ningún `e2e-preview` puede dar verde.

## Límites conocidos

- `concurrency` no es FIFO: ver «Concurrency». Con tres PR esperando, la del medio queda en `error` hasta
  re-ejecutarla.
- #205 no se cierra con el merge (decisión 3-A): hace falta una corrida real de `e2e-preview` GREEN posterior.
- `main-flow` Flow 4 sigue bloqueado por #200 (proyección de documentación del courier): mientras no se
  resuelva, `e2e-preview` va a dar `failure` por ese flujo. No se debilita el test.
- E2E post-merge contra el deployment de `develop` (después de `migrate-develop`): no implementado. Requiere
  ordenar el aviso de Vercel con el fin de la migración.
- Una PR abierta antes de que este workflow llegue a `develop` igual queda cubierta: el workflow se lee de
  `develop`, no de la rama.
