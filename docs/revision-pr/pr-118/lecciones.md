# Lecciones — PR #118 (T-206)

## Ronda 1
- H01/H02/H03/H04: enumerar la clase completa de transiciones, filtros y destinatarios; no usar fixtures mínimas como proxy.
- H05/M01: la evidencia debe ser reproducible y corresponder al check realmente requerido.

## Ronda 2
- H04/H05: un rojo por TypeError/forma del mock no demuestra la propiedad semántica.
- H06/H07: best-effort debe cubrir throws y errores in-band.
- R01: no introducir un escape productivo para tolerar un mock incompleto.

## Ronda 3
- **H05:** registrar “un test falló” no sustituye ejecutar toda la batería mínima acordada. Para una mutación semántica, ordenar/separar controles de modo que falle la consecuencia de negocio (destinatario extra), no antes una aserción de implementación.
- **H07:** fail-closed incluye errores explícitos y también ausencia imposible/incompleta de datos críticos con `error:null`.
- **A01:** un cambio fuera de ficha puede aceptarse por decisión humana, pero debe registrarse como `aceptado`, no reescribirse como si nunca hubiese existido el desvío.
- **Sincronización:** antes del cierre final, la rama debe contener el develop actual aunque el merge-ref de GitHub CI ya pruebe integración automática.

## Ronda 4
- Una guarda compuesta con varios términos no queda completamente probada por mutar solo uno: si se agregan tests nuevos para términos independientes, cada propiedad nueva debe demostrar su RED correspondiente.
- No actualizar evidencia CI con cifras de un SHA anterior después de agregar tests; esperar el run del HEAD y distinguir explícitamente jobs todavía pendientes.

## Ronda 5
- Sin lección AG nueva. Se reutilizan `pr-63/AG-68` y `pr-63/AG-70`: cuando dos defensas redundantes conservan la misma conducta pública, una mutación de una sola defensa puede quedar verde legítimamente; la batería debe romper la propiedad observable sin adulterar el test.
- Una autorrevisión no sustituye el estado de la revisión independiente: mientras haya hallazgos abiertos, el body no debe autofirmar `SIN BLOQUEANTES`.
