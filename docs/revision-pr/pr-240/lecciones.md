# Lecciones — PR #240 / T-334

**Fuente:** 4 hallazgos; H01/H02/H04 cerrados, H03 manual pendiente.

## Patrón dominante

No alcanza con clasificar rutas como “onboarding” vs “operativas”: dentro del onboarding hay **etapas editables** y **etapas terminales que presuponen un estado ya persistido**.

No se propone un AG nuevo; H04 refuerza P07/AG-37: enumerar la clase real, no confiar en un prefijo semántico demasiado amplio.

## Lecciones de esta PR

- **H01:** una excepción exacta no debe implementarse con matcher de descendientes.
- **H02:** el marcador de completitud debe escribirse después del último fallo que todavía significa “no enviado”.
- **H04:** una ruta terminal como `status` no debe quedar dentro de una excepción genérica `/onboarding/*` si su UI presupone que el flujo terminó.
- **H03:** la prueba manual aporta valor justamente porque detectó un contrato equivocado que los tests habían codificado como correcto.

## Infra fuera del alcance

#243 sigue abierto para aislar las mutaciones de CC-007.

## Pendiente

Repetir solo el flujo manual courier sobre `4bf9cfa` o posterior. Si pasa, no quedan hallazgos de T-334 abiertos.
