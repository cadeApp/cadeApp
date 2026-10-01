# Lecciones — PR #167 / T-322

## Ronda 1

- **H01 / P08:** un `required` HTML no convierte un campo en obligatorio en una Server Action; la frontera Zod debe imponer la misma propiedad y probar omitido/vacío/whitespace.
- **H02 / P08:** corregir la primera pantalla de un flujo Auth no demuestra el flujo completo. La propiedad a probar es registro → confirmación → destino, incluyendo las representaciones de confirmación que ya soporta la app.
- **H03 / P05:** anti-enumeración exige indistinguibilidad, pero también copy condicional: no afirmar un efecto remoto que deliberadamente puede no haber ocurrido.
- **H04 / P04:** un test que siempre entrega el valor correcto no protege contra la reintroducción de un fallback incorrecto. La mutación debe corresponder exactamente al comportamiento que el test dice cubrir.
- No se agrega numeración AG nueva en esta ronda.

## Ronda 2

- H01–H04 confirman que los controles nuevos ya alcanzan la propiedad que declaran.
- **R01 / P05:** cuando un schema cambia la obligatoriedad de un dato, los textos legales que describen ese schema forman parte del contrato funcional y deben versionarse en la misma decisión de producto.
- El freno de alcance funcionó: el agente no editó `src/features/legal/**` sin autorización y CI hizo visible la contradicción.
- Decisión P1: opción A; ampliación mínima formalizada en PR #168.
