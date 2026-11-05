# E2E de cada PR contra un build en el runner

## Decisiones P1

- 2026-10-02: las PR internas se validan con E2E sobre Supabase Develop compartido. Staging deja de ser el entorno de
  iteración por PR y queda reservado para checkpoints/release candidates.
- 2026-11-04 (T-422): el E2E de cada PR ya no corre contra un Vercel Preview. El runner de GitHub Actions hace el
  build del SHA exacto y lo levanta en `127.0.0.1:3100`, igual que `e2e-mutation` (T-347). Los minutos de build de
  Vercel se cobran y los de Actions no (repo público): `cadeapp-develop` llegó a 1107 deploys en 3 semanas.
- Vercel solo construye `develop` (Ignored Build Step del proyecto `cadeapp-develop`); GitHub Actions no despliega
  Vercel Develop.
- Las PR con migraciones no aplican schema remotamente a Supabase Develop antes del merge.

`e2e-staging.yml` corre después del deploy a staging. Desde T-331 ningún gate lista specs: corren los proyectos de
`playwright.config.ts`.

- **`chromium`:** todos los `e2e/specs/*.spec.ts` salvo `*.global-settings.spec.ts`; corre en `e2e-preview` y en
  staging.
- **`global-settings`:** los `*.global-settings.spec.ts`, en serie; corre solo en `e2e-preview`, porque cambia
  `platform_settings` de la base compartida.

Un spec nuevo de una tarea entra solo al gate, sin tocar `.github/**`.

## Circuito

```
push a la rama de la PR
  → CI (ci.yml) corre sobre la PR
  → CI termina → workflow_run completed
  → e2e-preview.yml · resolve-pull-request: ¿el CI vino de una PR y terminó en verde? ¿hay UNA PR interna abierta
    contra develop cuyo head es ese SHA, y es la PR que disparó ese CI? ¿toca supabase/migrations?
  → e2e-preview.yml · e2e-preview: checkout del SHA, pnpm build sin secretos privilegiados, pnpm start en
    127.0.0.1:3100, health check, proyecto chromium y después global-settings, con --workers=1
  → commit status `e2e-preview` en el SHA de la PR
```

El run aparece en Actions sobre `develop` (así funciona `workflow_run`), no en la pestaña Checks de la PR. Lo que se
ve en la PR es el commit status `e2e-preview`, que enlaza al run.

| Estado de `e2e-preview` | Significado |
|---|---|
| `pending` | CI verde, E2E en cola o corriendo |
| `success` | Todos los specs del SHA (proyectos `chromium` y `global-settings`) verdes contra el build del runner |
| `failure` | Algún spec falló, o el build no levantó: se corrige la PR |
| `error` · `BLOCKED / REQUIRES DEVELOP MIGRATION` | La PR toca `supabase/migrations/**`: no se corre E2E remoto |
| `error` · `E2E no corrió (...)` | El job se canceló o no arrancó: re-ejecutar el run |
| sin status | El CI de ese SHA no terminó en verde (o se canceló por un push nuevo), o no era una PR interna contra develop |

## Por qué `workflow_run` y no `pull_request`

`workflow_run` corre siempre con el workflow de la rama por defecto: la PR que se está probando no puede modificar
el gate que decide si recibe secretos, igual que con el `repository_dispatch` de Vercel que se usaba antes de T-422.
Con `pull_request`, una rama interna podría editar el workflow y llevarse los secretos del Environment `develop`.

Esperar al CI también evita gastar la cola compartida de Supabase Develop en un SHA que no compila o no pasa las
unitarias.

## Controles

- **Origen:** solo una corrida de `CI` con `event == pull_request` y `conclusion == success`. Un push a develop, un
  CI rojo, cancelado o sin terminar no corre E2E.
- **SHA exacto:** el `head_sha` de la corrida se busca en GitHub; tiene que ser el head de exactamente una PR
  abierta contra `develop`. Más de una: falla. El checkout y el status usan ese mismo SHA. Nada del evento se
  interpola en el YAML.
- **PR que disparó el CI (PR610-H02):** `workflow_run.pull_requests` tiene que traer una sola entrada, con el mismo
  número de esa PR, base `develop` y el mismo SHA. Si el mismo commit es head de otra PR (por ejemplo, contra
  `staging`) y el CI que terminó es el de esa otra, no hay E2E. Esas entradas no traen `full_name`: el repo ya se
  validó con la PR que devuelve la API.
- **Forks:** si el head de la PR no es `cadeApp/cadeApp`, no hay E2E ni secretos. No se usa `pull_request_target`.
- **Servidor:** escucha solo en `127.0.0.1:3100`; el browser entra por `localhost`. Su salida queda en
  `RUNNER_TEMP` y nunca se sube: el único artifact es `playwright-report/`.
- **Secretos (PR610-H01):** `environment: develop`, solo en el job de E2E. El step `Build PR without privileged
  secrets` compila solo con variables públicas que se embeben en el bundle: `NEXT_PUBLIC_APP_URL`,
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, la clave y el Map ID de Maps y la clave pública VAPID.
  La service role, `DNI_HMAC_SECRET` y `CRON_SECRET` existen solo en el step siguiente, que levanta ese build y corre
  Playwright sin volver a compilar. Ni el job ni el workflow heredan secretos. El resolvedor no recibe ninguno. La
  service role nunca es `NEXT_PUBLIC_*`.
- **Base correcta:** antes de sembrar se exige `NEXT_PUBLIC_SUPABASE_URL == https://<SUPABASE_DEVELOP_PROJECT_REF>.supabase.co`
  y que ese ref sea distinto al de staging (`SUPABASE_PROJECT_REF`).
- **Google Maps (D01 de T-422):** el build usa `vars.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` y
  `vars.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` del Environment `develop`, ya cargadas con los mismos valores públicos que
  el Preview. El step `Validate Maps public configuration` corta antes del build si alguna está vacía, nombrando
  la variable y sin imprimir su valor. La primera corrida real (PR #611) usó una clave falsa: los specs que no
  interceptan Google (incidentes, flujo principal) cargaban Google con una clave inválida y la vista de viaje se
  trababa. Sin Map ID, además, el mapa usa marcadores clásicos sin los `data-testid` que busca `map-privacy`.
  La clave del Preview podría no aceptar el origen `http://localhost:3100` (todavía no se vio): si Google
  responde `RefererNotAllowedMapError`, o si el consumo compartido molesta, se pasa a una clave exclusiva de CI.
- **Avisos push:** un par VAPID descartable por corrida (`Generate throwaway VAPID keys`, con `web-push`). La pública
  va al build y al servidor; la privada, enmascarada, solo al step del servidor.
- **Serialización:** un grupo de `concurrency` fijo, `cadeapp-develop-e2e`, igual para todas las PR y para
  `e2e-mutation`, con `cancel-in-progress: false` y `queue: max`. Ver «Concurrency» más abajo.
- **Seed/cleanup:** los de T-303 (`e2e/fixtures`, `src/server/e2e/staging-seed.ts`), sin cambios.

## Concurrency (decisión P1 5-A, ampliada por D03=B de T-422)

`e2e-preview` y `e2e-mutation` comparten el grupo `cadeapp-develop-e2e` con `cancel-in-progress: false` y
`queue: max`. La corrida en ejecución nunca se corta, y el grupo acepta hasta 100 corridas pendientes (antes de
`queue: max`, una sola: una tercera cancelaba a la que esperaba). Con la cola llena, una corrida nueva se cancela.
GitHub no promete un orden estricto por hora de llegada entre las pendientes.

No se implementa una cola propia. Lo que sí se garantiza:

- Dos E2E nunca corren a la vez contra Supabase Develop.
- Una corrida reemplazada, cancelada o que no llegó a ejecutarse deja el status `e2e-preview` en `error`
  («E2E no corrió»), nunca en verde.
- Esa corrida se recupera con «Re-run all jobs» sobre el run de `e2e-preview` en Actions, o volviendo a correr el CI
  de la PR.

## Migraciones

- `migrate.yml` corre `migrate-develop` solo por push a `develop` (es decir, después del merge): `supabase db push`
  a Supabase Develop y drift check de tipos, con `environment: develop`.
- Una PR que toca `supabase/migrations/**` se valida con `db-tests` del CI (Supabase local en el runner). Su
  `e2e-preview` queda en `BLOCKED / REQUIRES DEVELOP MIGRATION`; el E2E remoto se hace después del merge.
- `deploy.yml` sigue reaccionando solo a `migrate` de `staging` y `main`.

## Configuración manual

| Dónde | Nombre | Tipo |
|---|---|---|
| GitHub · Environment `develop` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_PASSWORD`, `DNI_HMAC_SECRET`, `CRON_SECRET` | secretos (ya existen) |
| GitHub · Environment `develop` | `SUPABASE_DEVELOP_PROJECT_REF` | variable (ya existe) |
| GitHub · Environment `develop` | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` | variables públicas, ya cargadas con los valores del Preview de Vercel (T-422); clave exclusiva de CI solo si aparece `RefererNotAllowedMapError` o el consumo compartido molesta |
| GitHub · repositorio | `SUPABASE_PROJECT_REF` (staging), `SUPABASE_ACCESS_TOKEN` | ya existen |
| Vercel · `cadeapp-develop` | Ignored Build Step | después del primer `e2e-preview` GREEN de T-422: solo `develop` |

`VERCEL_PROJECT_ID` del Environment `develop` ya no lo usa este gate.

### Requisito de seguridad (vigente desde T-327)

**Environment `develop` restringido a la rama `develop`.** GitHub → Settings → Environments → `develop` →
*Deployment branches and tags* → *Selected branches and tags* con una única regla: `develop`. El Environment guarda
la service role y la contraseña de la base. Con *No restriction*, cualquier workflow escrito en una rama interna
puede declarar `environment: develop` y recibir esos secretos. `e2e-preview` (`workflow_run`) y `migrate-develop`
(push a `develop`) corren ambos sobre `develop`, así que la regla no los afecta.

### Corte de los Preview de Vercel (T-422)

1. Mientras T-422 no esté en `develop`, el gate viejo sigue usando los Preview: el Ignored Build Step de
   `cadeapp-develop` solo saltea `docs/`, `review/`, `review-only/`, `claude/` y `release/`.
2. Con T-422 mergeada, la primera PR interna que termine el CI en verde tiene que dejar `e2e-preview` en `success`
   contra el build del runner.
3. Recién ahí el Ignored Build Step de `cadeapp-develop` pasa a construir solo `develop`:
   `[ "$VERCEL_GIT_COMMIT_REF" = develop ] && exit 1 || exit 0`.

## Límites conocidos

- La cola es de hasta 100 pendientes y sin orden estricto: ver «Concurrency». Una corrida cancelada por cola llena
  queda en `error` hasta re-ejecutarla.
- El E2E corre contra `next start` en el runner, no contra la infraestructura de Vercel (funciones, CDN, headers de
  `vercel.json`). Esa diferencia la cubren `e2e-staging` y el deployment de `develop`.
- Sin Preview por PR no hay una URL para mirar los cambios visuales de una PR: se revisan en local o en `develop`.
- E2E post-merge contra el deployment de `develop` (después de `migrate-develop`): no implementado.
- Una PR abierta antes de que este workflow llegue a `develop` igual queda cubierta: el workflow se lee de
  `develop`, no de la rama. Basta con un push nuevo o volver a correr su CI.
