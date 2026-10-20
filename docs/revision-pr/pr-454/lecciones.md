# Lecciones — PR #454 / T-384 · ronda 1

No se asignan números AG nuevos: los problemas observados ya encajan en reglas existentes.

- **AG-37 / P06:** barrer todas las variantes del mismo guard. Aquí el SQL acepta formas inválidas de entrada en más de un campo; el prompt solicita tabla completa `kind`, `storagePath`, `idempotencyKey` y comparación con fake.
- **AG-58, AG-75 / P08:** medir el contrato real y no el proxy. `has_function` no comprueba ninguna transición, y stubs `rpc()` que ignoran argumentos no detectan nombre equivocado.
- **AG-59 / P11:** SQL, fake y wrapper deben compartir precedencia de validación para las mismas entradas, no solamente nombres de errores.
- **AG-70 (referido en pr-82):** el mutante debe fallar por la aserción pertinente, no por TypeError o error del arnés.
- **Regla T-384 y user rule:** no fabricar RED/GREEN ni bajar coverage para lograr CI verde.

**Advertencia de proceso:** esta PR fue revisada mientras era Draft explícitamente incompleto. Los hallazgos registran ese estado, no un cierre funcional; los cambios del agy solo se consideran arreglados tras una nueva ronda independiente. No se fingieron mutaciones locales ni ejecución de Docker.

No proponer reglas nuevas para AGENTS.md solo por esta PR.
