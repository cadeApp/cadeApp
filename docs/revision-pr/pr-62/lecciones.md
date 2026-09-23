# Lecciones — PR #62 (T-101)

Numeración continua del proyecto. `AG-01`…`AG-56` están en las carpetas de las PRs anteriores.

---

## `AG-57` · Un contador transaccional no es un rate limit: mide éxitos, no intentos

`submit_offer` incrementa `public.rate_limits` con un upsert atómico y compara el resultado contra el tope. El
upsert es correcto, la atomicidad es real y el `on conflict` va contra la PK. Y aun así el limitador es ciego a
lo que un limitador existe para frenar.

El motivo es de una línea: el incremento vive **en la misma transacción que la RPC**. Cuando la función levanta
`OFFER_BELOW_MINIMUM`, `REQUEST_EXPIRED` o cualquier otra, el `raise` aborta la transacción y **el incremento se
va con ella**. Resultado:

| Tráfico | ¿Consume cuota? |
|---|---|
| 10 ofertas válidas en un minuto | sí |
| 10.000 ofertas bajo el piso | **no** |

O sea que la única forma de agotar la cuota es comportarse bien.

**La señal estaba en la propia prueba, y es lo que conviene aprender.** El test 31 no llama a la RPC once veces
para llegar al tope: **siembra el contador en 10 a mano** y después hace una llamada. Cuando un test tiene que
preparar a mano el estado que el código debería producir, casi siempre es porque el código no lo produce. Ese es
el olor a buscar.

**Qué cambiar:** dos cosas, y la primera es de lectura, no de código.

1. **Frente a cualquier contador dentro de una RPC, la primera pregunta es qué pasa cuando la RPC falla.** Si la
   respuesta es «se revierte», entonces mide operaciones completadas y hay que nombrarlo así — «ofertas exitosas
   por ventana» — y no «rate limit», que promete protección contra abuso.
2. **El freno de abuso no puede vivir en la misma transacción que la operación que protege.** Si hace falta de
   verdad, va antes de Postgres o en una transacción autónoma. Conviene que esté escrito en la ficha de la tarea
   que lo ponga, para que no se descubra otra vez desde el otro lado.

---

## `AG-58` · Una aserción de texto sobre un archivo con N funciones prueba como mucho una de las N

`offers.test.ts` tiene un caso llamado «Contrato SQL: la migración de T-101 define SECURITY DEFINER, search_path
fijo, FOR UPDATE, rate_limits atómico y solo códigos de `RPC_CONTRACTS`». Lo verifica así:

```ts
expect(sql).toMatch(/security definer/i);
expect(sql).toMatch(/set search_path = public, pg_temp/i);
expect(sql).toMatch(/for update/i);
```

El archivo tiene **tres** funciones. Una coincidencia satisface cada `toMatch`, así que se puede quitar
`security definer` de dos de las tres y el caso sigue verde. Y la ficha dice, en negrita, que estas RPC
*«tienen que ser `security definer`»*, porque desde T-005 la RLS congela los estados y son el único camino.

Lo mismo con la comparación de códigos: junta los `errorCodes` de las tres RPC en un solo `Set`, así que un
código levantado por la función equivocada pasa; y solo comprueba «levantado ⊆ declarado», nunca al revés. Por
eso el `INVALID_STATE_TRANSITION` que `withdraw_offer` declara y jamás levanta le resulta invisible. Lo encontré
con un barrido de veinte líneas que compara los dos sentidos **por función**.

**La forma general:** `toMatch` sobre el archivo entero responde «¿existe esto en algún lado?». La pregunta que
casi siempre importa es «¿lo cumplen todos los que deberían?». Son preguntas distintas y la primera se disfraza
muy bien de la segunda, porque el nombre del caso enumera las tres funciones.

**Qué cambiar:** cuando un control mira texto de un archivo con varias unidades, se parte primero por unidad y se
verifica cada una. En SQL eso es partir por `create or replace function` y exigir la propiedad dentro de cada
bloque. Y cuando se comparan dos catálogos, se comparan **en los dos sentidos**: lo que sobra en uno es tan
hallazgo como lo que falta en el otro.

Es pariente de `AG-51` (un control que enumera selectores se desactualiza cuando el código elige otros
elementos) y de `AG-56` (un presupuesto en bytes no distingue un archivo de un archivo vacío): las tres son
controles que miden una propiedad más barata que la que su nombre promete.
