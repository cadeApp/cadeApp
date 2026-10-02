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
- **Cola:** `concurrency: cadeapp-develop-e2e` sin cancelar, igual para todas las PR.
- **Seed/cleanup:** los de T-303 (`e2e/fixtures`, `src/server/e2e/staging-seed.ts`), sin cambios.

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
| GitHub · repositorio o Environment `develop` | `SUPABASE_DEVELOP_PROJECT_REF` | variable (**falta**) |
| GitHub · repositorio | `SUPABASE_PROJECT_REF` (staging), `SUPABASE_ACCESS_TOKEN` | ya existen; el token debe tener acceso al proyecto Supabase Develop |
| Vercel · `cadeApp-develop` | Deployment Protection de los Preview | hoy responde 302 a `vercel.com/sso-api`: el health check falla hasta que se desactive Vercel Authentication para Preview o se agregue un bypass de automatización |
| Vercel · `cadeApp-develop` | Eventos `repository_dispatch` hacia GitHub | deben estar habilitados (Settings → Git) |

Recomendado: limitar el Environment `develop` a la rama `develop` (Deployment branches). `e2e-preview` y
`migrate-develop` corren ambos sobre `develop`, y así ningún workflow editado en una rama puede pedir esos secretos.

## Límites conocidos

- La cola de GitHub guarda un solo run pendiente por grupo: con tres PR esperando, el del medio se cancela y
  su status queda en `error` hasta re-ejecutarlo.
- `main-flow` Flow 4 sigue bloqueado por #200 (proyección de documentación del courier): mientras no se
  resuelva, `e2e-preview` va a dar `failure` por ese flujo. No se debilita el test.
- E2E post-merge contra el deployment de `develop` (después de `migrate-develop`): no implementado. Requiere
  ordenar el aviso de Vercel con el fin de la migración.
- Una PR abierta antes de que este workflow llegue a `develop` igual queda cubierta: el workflow se lee de
  `develop`, no de la rama.
