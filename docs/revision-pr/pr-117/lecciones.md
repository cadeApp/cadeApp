# Lecciones de la PR #117 para `AGENTS.md` y las reglas

**Fuente:** 5 hallazgos abiertos + 1 desvío aceptado. Datos crudos en [`hallazgos.jsonl`](hallazgos.jsonl).

## Patrón dominante

Vuelve a aparecer **P08-control-no-cubre-lo-que-dice**: el test crea un sustituto barato del invariante y queda verde sin atravesar el runtime que el usuario va a ejecutar.

En esta PR ocurre dos veces con impacto distinto:

- T03: el fixture inventa su propio botón `disabled={isOffline}`, mientras el botón real de ofertar no conoce el estado offline.
- Service Worker: el test importa `src/app/sw.ts`, mientras el navegador registra `public/sw.js`.

También la “verificación visual” usa jsdom como proxy de navegador real.

## Lecciones propuestas

No se agrega un número AG nuevo en R1. El protocolo de revisión ya marca P08 como patrón reincidente y las reglas existentes de pruebas/visual ya exigen ejercer el runtime real y mostrar evidencia roja.

La acción útil acá es **aplicar esas reglas**, no duplicarlas con otra frase.

## Qué cambiar, en orden de impacto

1. En los prompts de corrección, nombrar siempre el componente/script productivo que el test debe atravesar.
2. Prohibir explícitamente fixtures que implementen dentro del test la propiedad que se pretende validar.
3. Para assets ejecutados fuera del bundle principal (SW, workers, scripts públicos), hacer que la prueba cargue el artefacto que realmente consume el navegador.
4. Separar “test DOM” de “evidencia visual”: el primero evita regresiones; la segunda requiere navegador/captura.

## Advertencias

- T-201 es especialmente propensa a falsos positivos porque mezcla App Router, un script estático de Service Worker y estados de navegador que jsdom no reproduce por completo.
- H05 es documental/operativo y no justifica por sí solo una regla nueva.
