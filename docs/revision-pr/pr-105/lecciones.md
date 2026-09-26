# Lecciones — PR #105 / T-106

No se agrega numeración AG nueva.

## Ronda 1

- H01 aplica `pr-56/AG-37`: una vista segura no cierra la clase si queda abierta la vía directa a la tabla.
- H02 aplica `pr-63/AG-70`: el rojo se registra desde la salida real, no desde el resultado esperado.

## Ronda 2

Los dos patrones quedan cerrados sin necesidad de regla nueva.

### Confirmación de AG-37

El contracaso que faltaba fue exactamente la vía paralela: consultar `public.merchants` como courier relacionado. Al escribirlo, quedó rojo sobre la policy vieja y verde solo después de eliminarla.

### Confirmación de AG-70

La corrección no reescribió la sesión histórica. Agregó otra entrada con el fallo real y separó el rojo inválido del fixture del RED posterior que sí ejecutó 24 aserciones.

## Qué conservar

1. Cuando una vista reemplaza una superficie RLS, probar **vista nueva y tabla vieja**.
2. Un cambio de superficie en una matriz de RLS conserva la semántica del test; no se cambia el actor ni el resultado esperado.
3. La evidencia de TDD incluye la aserción que falló y cuántas llegaron a ejecutarse, no solo `exit 1`.
4. Las mutaciones se hacen sobre implementación; nunca se adulteran tests, fixtures o planes para fabricar verde.
