# Informe de revisión — PR #248 / T-336 — Ronda 4 extraordinaria

**HEAD:** `5847daf744f5bc6168af11365b6731520f4c4c5c`  
**Fecha:** 2026-10-04  
**Resultado:** **CON BLOQUEANTE MANUAL REABIERTO (1)**

## Por qué se reabre

La revisión había cerrado H04 apoyándose en la matriz registrada y en controles exact-head. Después, Lautaro073 ejecutó personalmente una validación adicional y obtuvo:

| Caso | Esperado | Real |
|---|---|---|
| Anónimo | `/login` | `/login` |
| Courier completo | `/courier/feed` | `/login` después del 404 |

Secuencia courier:

1. login exitoso;
2. URL final inicial `/courier/feed`;
3. abrir una URL inexistente;
4. 404 con «Ir al inicio»;
5. activar el enlace;
6. final: `/login`.

Esto contradice el contrato principal de T-336 y prevalece sobre el cierre anterior.

## Análisis del código

`evaluateRouteGuard` sí tiene la semántica correcta:

- una sesión courier activa en `/login` debería recibir `getSessionHomePath(session)`;
- courier completo → `/courier/feed`.

`updateSession()` construye la sesión desde:

`supabase.auth.getUser()`

y luego llama `evaluateRouteGuard(request.nextUrl.pathname, session)`.

Por eso, si `/login` realmente llega al middleware con una sesión courier, no debería renderizar login.

### Frontera sospechosa

Los controles genéricos usan:

`<Link href="/login">...`

La ruta `/login` ya fue visitada en estado anónimo antes del login. La hipótesis principal es una navegación cliente/cacheada que puede mostrar el login anterior sin forzar el round-trip que necesita middleware.

Hipótesis alternativa: la cookie de auth deja de estar disponible/reconocida entre `/courier/feed` y el 404.

No se prescribe el fix hasta distinguir ambas.

## Diagnóstico obligatorio

Usar **una sola Page y un solo BrowserContext**:

1. login courier;
2. confirmar `/courier/feed`;
3. registrar únicamente **nombres/dominio/path** de cookies Supabase; nunca valores;
4. `page.goto('/t336-404-session-regression')`;
5. volver a registrar cookies;
6. hacer click real en «Ir al inicio»;
7. registrar URL final y si existió request/response a `/login`;
8. registrar cookies después del click.

Si queda en `/login`, hacer una prueba de control **sin reloguear**:

- hard navigation/reload documental a `/login`.

Interpretación:

- **cookies siguen presentes + hard navigation redirige a `/courier/feed`:** bug de navegación cliente/cache del gateway;
- **cookies desaparecen antes del click:** bug de persistencia/rotación de sesión;
- **cookies presentes + hard navigation también queda en `/login`:** middleware/session reconstruction no está reconociendo la sesión; investigar `updateSession`.

## Regresión automática obligatoria

La clase de bug es browser-level y no queda protegida por un unit test de `evaluateRouteGuard`.

Agregar un E2E real usando los fixtures existentes:

- login courier en la misma `page`;
- visitar una ruta 404;
- click en «Ir al inicio»;
- esperar URL final `/courier/feed`.

Ese test debe ser RED antes del fix y GREEN después.

## Fix esperado si se confirma cache/client navigation

Forzar una **navegación de documento** hacia `/login` desde los controles genéricos de error/404 para garantizar que middleware procese la sesión.

Aplicar la misma semántica a:
- NotFoundView;
- ErrorView.

No usar un cambio de auth/server si el diagnóstico demuestra que la cookie y el middleware funcionan con hard navigation.

Si una navegación nativa `<a>` dispara una regla ESLint de Next, usar una solución explícita/documentada de hard navigation; no desactivar globalmente lint.

## Verificación final

Después del fix:
- E2E courier 404 → home real GREEN;
- anónimo 404 → login;
- guard unitario sigue GREEN para todos los roles;
- 360 px sigue sin overflow y target 48 px;
- Preview real;
- CI completo exact-head.

## Resultado

PR248-H04 reabierto. No mergear.
