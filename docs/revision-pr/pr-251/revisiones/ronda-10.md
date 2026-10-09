# PR #251 · T-313 — Ronda 10

- **Fecha:** 2026-10-07
- **Base revisada:** `4f3dacd01dc350c36f937a629ddfd6bf1f2a9f78`
- **Commit ronda 9:** `8746eba32d4519ed828c5190bad03ede3d84f7db`
- **Resultado:** CON BLOQUEANTES (3)
- **Hallazgos nuevos:** 0
- **Decisiones nuevas:** 0
- **Objeto de esta ronda:** corregir la estrategia de validación de H11 según el pipeline real de migraciones.

## Restricción verificada

`.github/workflows/migrate.yml` declara explícitamente:

- Supabase Develop se migra solo en `push` a `develop`;
- una rama feature nunca aplica migraciones a esa base compartida.

El trusted `e2e-preview` prueba el Vercel Preview de la PR **contra Supabase Develop compartido** y no ejecuta `db push`.

Por eso una migración nueva de PR #251:
- sí entra en `db-tests`, que levanta Supabase local, aplica todas las migraciones de la rama y corre pgTAP;
- no existe todavía en Supabase Develop mientras la PR siga abierta.

## Consecuencia para D03-A

Se mantiene la decisión A, pero la evidencia se divide correctamente:

### Action
El cambio de `.upsert()` a UPDATE autenticado debe permitir que el flujo de onboarding normal quede GREEN en Preview aun con la policy vieja de Develop, porque el E2E actual deja `notes` vacío y la fila ya existe desde `handle_new_user()`.

### RLS / notes
La policy nueva que permite editar `notes` no puede exigirse en el Preview pre-merge. Debe probarse con:
- pgTAP en `db-tests`;
- unit tests de la action que demuestren que `notes` forma parte del payload editable;
- prueba negativa que mantenga protegidos `subscription_status` y `paid_until`.

No se debe:
- aplicar manualmente la migración de la rama sobre Supabase Develop;
- agregar INSERT self;
- usar service role/admin para evitar la policy;
- modificar el E2E para depender de una policy que aún no puede existir en Develop.

## RED válido para H11

Antes del fix:
- el trusted E2E `37575010421` ya demuestra el RED real del flujo por `merchantUpdated=false`;
- un pgTAP que intente cambiar `notes` como merchant activo debe fallar con la policy actual;
- los unit tests deben exigir UPDATE + cero filas fail-closed.

Luego del fix:
- unit GREEN;
- `db-tests` GREEN con la migración de la PR;
- trusted E2E GREEN para el flujo normal.

## H04

Después de ese baseline GREEN recién se ejecuta D02-A.

T-347 sigue siendo solo una ficha: el workflow trusted de mutaciones todavía no existe en `develop`, así que no reemplaza la autorización previa de T-313.

## Veredicto

H04 + H10 + H11 continúan abiertos.

No apruebo ni mergeo.
