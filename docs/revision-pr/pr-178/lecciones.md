# Lecciones — PR #178 / CC-014

## Ronda 1

No se agrega número AG nuevo.

- **H01 / P05:** cuando un mismo estado alimenta UI y efectos laterales, hay que enumerar todos sus productores. Un `activeCoords` correcto para el pin puede ser incorrecto como trigger de cámara.
- **H02 / P08:** un RED masivo por fallo de setup no demuestra 43 comportamientos. La evidencia TDD debe aislar cada clase de contrato que pretende probar.
- **H03 / P11:** helpers de test no deben ampliar silenciosamente la API pública de un módulo contractual.
- **H04 / P10:** el contract-change no termina en el documento; la coordinación de tareas bloqueadas también forma parte del flujo para evitar trabajo concurrente sobre un contrato todavía no mergeado.

## Ronda 2

No se agrega número AG nuevo.

- **H01 / P05:** separar dos estados no alcanza si la API es controlada. Hay que probar también el round-trip `evento interno → onChange → value del padre → effect`, porque el eco del padre puede reintroducir exactamente el efecto que se quiso eliminar.
- **H02 / P08:** la evidencia dirigida corrigió el problema de atribución del RED; cada diferencia de contrato ahora tiene una precondición verificable separada.
- **H03 / P11:** el lifecycle real puede aislarse sin exportar hooks de test desde un módulo contractual.
- **H04 / P10:** no aceptar como hecho un cambio de coordinación solo porque el body lo declara; las labels deben releerse desde GitHub.

## Ronda 3

No se agrega número AG nuevo.

- **H01 / P05:** distinguir origen interno/externo no basta si el efecto receptor deduplica solo por valor. Una “orden nueva hacia la misma coordenada” y “ninguna orden nueva” son estados distintos; si el contrato depende de esa diferencia, hay que modelar identidad/versión del comando.
- Un test de eco controlado debe complementarse con la secuencia inversa: después de ignorar correctamente el eco, una actualización externa posterior tiene que seguir siendo observable aunque vuelva al target previo.
- **H04 / P10:** la metadata quedó verificada leyendo el issue, no por el body.
