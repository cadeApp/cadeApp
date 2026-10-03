# Lecciones de la PR #237 para `AGENTS.md` y las reglas

**Fuente:** 3 hallazgos. Ronda 2 no agrega hallazgos nuevos.

## Patrón dominante

No falta una regla nueva. H01 sigue siendo una aplicación directa de pr-56/AG-37 y P06; H02 de P13 + directiva visual; H03 de un DoD visual explícito que no puede cerrarse solo con unit tests.

## Ronda 2

- H01 quedó corregido en estructura y el test ahora enumera documento × etapa de fallo × estado previo exitoso.
- H02 incorporó foco visible y control específico.
- H03 pasó de «sin evidencia» a «falta un único estado real: success/Cargado».
- El 403 observado no justifica tocar RLS: el registro normal activa el consentimiento mediante CC-007. La lección operativa es usar una cuenta creada por el flujo vigente, no una cuenta vieja que quedó `pending`.

## Sin AG nueva

Agregar una regla nueva duplicaría controles ya existentes. La mejora útil es ejecutar esas reglas al cerrar la tarea: enumerar la clase completa, probar foco real y no sustituir navegador por mocks cuando la ficha exige evidencia visual.

## Advertencias

La revisión R2 no tuvo un checkout ejecutable y no firma H01/H02 como `arreglado-verificado`. La verificación final debe ocurrir sobre el SHA exacto que incluya la evidencia de success.
