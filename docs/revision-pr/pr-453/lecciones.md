# Lecciones — PR #453 / T-377

## Patrón dominante

El manejo de errores de servicios externos debe distinguir fallos de **SDK**, **carga de biblioteca**, **cálculo** y **datos incompletos**. Verificar un fallback de `computeRoutes` no prueba que el rechazo de `importLibrary` esté manejado. Un estado de UI debe describir lo que de verdad se dibuja.

## Aprendizajes observados

- **H01 — P05:** los textos de un componente deben compartir la guarda de disponibilidad con el elemento visual al que se refieren. La nueva prueba C06 comprueba `!isMapAvailable` junto con ausencia real de `Polyline`.
- **H02 — P01:** cuando se depende de un hook de terceros, leer la implementación de la **versión fijada** y no asumir que captura un rechazo por devolver un estado `null`. Añadir una prueba que haga fallar la importación misma, no una etapa posterior. La ficha original también prescribía el hook; por eso el origen es `ambos`.
- **H03 — P08:** timeout de carga de biblioteca y timeout de cómputo son operaciones distintas. Cada uno debe tener su caso de promesa que nunca resuelve; `active/settled` previenen publicación tardía y repetida.

## Rondas

- Ronda 1 en SHA `253fee23`: 2 bloqueantes y 1 mejora aceptada por Lautaro073 (D1-B y D2-B).
- Ronda 2 en SHA `1aa54578`: los tres arreglos aparecen en código por inspección; CI/E2E verde, incluido `reject-import`.
- El autor declaró mutaciones RED→GREEN nuevas, pero **esta revisión no las ejecutó de forma independiente**. No reemplazar `arreglado-sin-verificar` por `arreglado-verificado` hasta repetirlas con harness propio y salida reproducible.

## Regla general

No se asigna un identificador `AG-xx` ni se edita `AGENTS.md` sin contrastar el catálogo de lecciones y el máximo entre **todas las ramas remotas**. Esta PR no requiere refactor genérico, nuevas dependencias ni cambios de infraestructura.

## Siguiente paso

Correr el arnés de revisión de `evidencia/comandos.md` desde un worktree limpio del SHA revisado y actualizar solo entonces estado/evidencia del JSONL; confirmar PR en condiciones de merge tras esa verificación. Los commits puramente documentales de revisión no requieren repetir CI.
