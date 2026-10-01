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

## Ronda 3

- PR167-R01 quedó cerrado: versionar el documento legal y actualizar los controles dependientes evita reescribir silenciosamente el contrato previo.
- **PR167-A01 / P10:** una necesidad técnica legítima no autoriza a la rama a editar su propia ficha para ampliar alcance. La decisión debe existir primero en `develop`; recién después el trabajo queda dentro de alcance.
- `verify-fichas.test.ts` no detecta autoampliaciones de la lista “Archivos permitidos”; este caso queda como evidencia para evaluar un control futuro si P10 vuelve a aparecer.

## Ronda 4

- PR167-A01 quedó formalizado correctamente mediante una PR documental previa en `develop`; el mismo cambio que antes era fuera de alcance ahora queda trazable y autorizado.
- El merge de `develop` posterior a la decisión no modificó código funcional, lo que permitió revalidar los hallazgos anteriores contra el exact-head sin abrir una nueva clase de defecto.
- La evidencia manual de Auth/Storage se mantiene como paso de staging posterior al merge, no como sustituto de los controles automatizados.
