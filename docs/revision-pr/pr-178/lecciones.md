# Lecciones — PR #178 / CC-014

## Ronda 1

No se agrega número AG nuevo.

- **H01 / P05:** cuando un mismo estado alimenta UI y efectos laterales, hay que enumerar todos sus productores. Un `activeCoords` correcto para el pin puede ser incorrecto como trigger de cámara.
- **H02 / P08:** un RED masivo por fallo de setup no demuestra 43 comportamientos. La evidencia TDD debe aislar cada clase de contrato que pretende probar.
- **H03 / P11:** helpers de test no deben ampliar silenciosamente la API pública de un módulo contractual.
- **H04 / P10:** el contract-change no termina en el documento; la coordinación de tareas bloqueadas también forma parte del flujo para evitar trabajo concurrente sobre un contrato todavía no mergeado.
