# Lecciones — PR #361, ronda 1

El objeto de esta revisión es un Draft TDD **todavía sin implementación**, de modo que no se atribuye a producción un defecto no implementado. Lo observado en tests es relevante desde ahora:

- **H02:** no compartir mocks acumulados entre casos que se verifican con `toHaveBeenCalled()`. Requerir aislamiento y mutación de la rama exacta.
- **H03:** los dobles deben representar la unión discriminada real de `ActionResult`; idealmente el tipo de TypeScript debe impedir la forma ficticia `{error: ...}`.
- **H04:** las pruebas de estados temporales deben congelar fecha/hora e incluir caducidad efectiva del backend, no solo el nombre del estado.

No se asigna un número AG nuevo ni se modifica `AGENTS.md` en esta ronda inicial. Revaluar tras tener código y evidencia independiente.

## Ronda 2 — patrones nuevos (sin número AG nuevo)
- **H05 / P08:** un E2E puede usar datos y RPC reales pero no comprobar la UI que dice proteger. Revisar cada spec nueva por `page`, navegación, interacción y oráculo del DoD.
- **H06 / P01:** un modal controlado desde el padre debe limpiar su estado también ante cierre `open=false` programático, no solo cuando su propio control emite `onOpenChange`.
- **H07 / P08:** `disabled={isPending}` no reemplaza una exclusión sincrónica al inicio del handler async ni su test con promesa diferida.
- **H08:** distinguir `ActionResult.ok=false` de una promesa rechazada. Cubrir ambos con oráculos distintos.
- **H09 / P04:** no calcular en el test la expectativa invocando la misma función de traducción de errores que se está validando. Probar además el camino productivo, no exclusivamente un callback inyectado.

Estos problemas están identificados por inspección; no proclamar mutaciones exitosas sin poder correrlas. No cambiar `AGENTS.md` por un caso aislado.

## Ronda 3 — evidencia de reincidencia (sin numeración AG nueva)
- **H11 / P04:** un E2E puede hacer pasos reales y luego afirmar un texto de navegación persistente, no la entidad que acaba de mutar. Oráculos de UI deben ligar el ID concreto y el cambio de contador, además del SQL.
- **H12 / P08:** una prueba titulada de navegador nunca debe tener un `else` que la convierta en test directo de RPC. Si faltan `page` o credenciales de fixture, fallar cerrado. El autor debe informar SHA/run E2E para afirmar ejecución.
- **H13 / P01:** `as any` incluso en tests de concurrencia inutiliza el tipo cuya interfaz se quiere proteger; usar el retorno de `typeof action` para promesas diferidas.
- El autor sí corrigió guard, catch, reset y 48px; no pedirles que se reimplementen. Falta la reproducción independiente RED→GREEN para cambiar sus estados a verificados.

## Ronda 4 — Cierre de código vs cierre de ejecución
- H11 y H13 aparecen corregidos en el diff y unit/typecheck están verdes, pero el DoD no se cumple si el E2E Browser real no corre en el entorno autorizado.
- H12 ilustra la diferencia entre **fail-closed correcto** (el local bloqueó proyecto Supabase desconocido) y **E2E exitoso de Preview** (no demostrado). No confundir 'falla segura' con 'prueba superada'.
- El repo tiene gate `.github/workflows/e2e-preview.yml` en trusted default branch disparado por `repository_dispatch` y que publica el status `e2e-preview` al commit probado. La señal objetiva de cierre es **status success para el SHA**, no un comentario afirmando que el runner dispone de credenciales.
- No asignar un nuevo hallazgo duplicado: H12 sigue abierto por evidencia. No tocar `AGENTS.md` por una PR aislada.

## Ronda 5 — Evitar misdiagnósticos de integración y rondas redundantes

- Un evento `repository_dispatch` puede pertenecer a distintos proyectos Vercel del mismo repo. `matchPreview` explícitamente descarta proyectos ajenos; **una corrida skipped no demuestra que un secret esté mal**. Correlacionar siempre deployment/project/SHA y buscar eventos aceptados antes de recomendar cambiar configuración sensible.
- La evidencia E2E debe cruzar **tres señales**: run del trusted workflow, línea del test específico y commit status `e2e-preview` sobre el SHA; el job Vercel `Ready` no sustituye el test.
- Registrar una prueba inestable de un feature ajeno, como T-314 en retry, sin volverla bloqueante de T-364 ni esconder el fallo inicial.
- Cuando una revisión agrega únicamente documentación después de una ejecución remota larga, moverá el SHA y reactivará los checks. Diferenciar explícitamente **SHA verificado** y **HEAD post informe**, evitando falsear resultados y repetir arreglos de código.
