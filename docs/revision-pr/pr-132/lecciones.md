# Lecciones — PR #132 (T-316)

## Ronda 1

No se agrega número AG nuevo.

- **PR132-H01** es otra instancia de `P08-control-no-cubre-lo-que-dice`: probar staging no implica haber probado production, y comprobar que existe una sección `concurrency` no demuestra sus dos invariantes relevantes.
- Un regex sintáctico de cron puede aceptar valores semánticamente inválidos. Si el contrato dice “minuto y hora fijos”, conviene validar los rangos, no solo la cantidad de campos.
- **PR132-A01** repite el desvío de ficha previa visto en T-315. La excepción fue autorizada explícitamente otra vez; no se convierte en regla.
- D02 deja una distinción operativa importante: una variable usada en un `if` de job debe estar disponible antes de enviar el job al runner. Para T-316 se eligió repository variable para `PRODUCTION_APP_URL`; el secreto sigue aislado en el environment.

## Ronda 2

No se agrega número AG nuevo.

- H01 queda cerrado al probar el contrato simétricamente sobre staging y production, en vez de suponer que dos bloques parecidos seguirán iguales.
- Validar límites también requiere un caso positivo de borde. `59 23 * * *` GREEN junto a `60`/ `24` RED demuestra que el control no es solo una blacklist de valores malos.
- Las mutaciones propias distintas siguen siendo útiles aunque el autor entregue una batería extensa: reemplazar APP_URL, invertir la condición y reordenar curl/guard atacan propiedades semánticas distintas.
- Los fallos locales de suite completa no se elevan a hallazgo cuando el mismo SHA ejecuta 1381/1381 en CI limpio y los tests aislados también son verdes.
