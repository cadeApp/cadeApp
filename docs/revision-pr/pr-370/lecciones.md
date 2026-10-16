# Lecciones — PR #370 / ronda 1

No se enumeran nuevos hallazgos de implementación ni se asigna un nuevo número AG: esta ronda revisó una detención de trabajo correcta y un único archivo de bitácora, no código nuevo. El bloqueo contractual no se atribuye como defecto al autor.

## Patrones ya documentados a vigilar al retomar

- **AG-74** (pr-68): guarda condicional de expiración debe volver a validar `status` y `expires_at` bajo lock; auditoría y efectos solo desde filas realmente cambiadas.
- **AG-37** (pr-56): enumerar toda la clase afectada (estados, actores, tablas, RPC, paginaciones) antes de dar la corrección por buena.
- **AG-75** (pr-68): la batería de mutaciones es del revisor, no del autor.
- **P08**: tests que inspeccionan strings SQL o mocks sin ejecutar un caso real no prueban permisos/transacciones.

Criterio para ronda 2: ningún hallazgo puede darse como `arreglado-verificado` solo por la declaración de Kira o por checks verdes. Exigir ensayo que falle por la propiedad comprobada, prueba sin mutar y verificación en SHA publicado.

## Ronda 2 — lección sin nuevo número AG

- **P05 + P08** (`pr-370/R2`): la prueba de SKIP LOCKED confirmó la cantidad de llamadas (1) y permisividad, pero no el resultado que importa: **con `hasMore=true` la lectura no está completa**. Cuando un agente crea una prueba de no-loop, debe combinarla con el invariante fail-closed; si no, la prueba consolida el bug. La revisión independiente encontró H01/H02 que no estaban en la autorrevisión del agy.
- **P15** (`pr-370/R2`): marcar DoD de E2E completo requiere **una ejecución E2E real PASS en el SHA revisado**, no solo un archivo .spec.ts modificado o CI unit GREEN. La corrida de este SHA fue cancelada.
- **P10** (`pr-370/R2`): las fuentes de verdad viven en develop. Una ficha modificada dentro de la misma PR no cumple el gate previamente acordado de incorporarla en develop antes de implementar.
- No asignar AG sin calcular máximo de todas las ramas remotas; este entorno no tiene clon GitHub resoluble. Los comentarios y reportes siguen citando por carpeta.

## Ronda 3

- H01/H02 corregidos con el invariante correcto `hasMore=false` para permitir SELECT. El test nuevo no se limita a número de llamadas RPC, sino que verifica que la lectura SQL no se ejecuta mientras haya lock; control causal más fuerte.
- H03: 79 E2E Chromium y 3 settings PASARON; distinguir ejecución real de cobertura del DoD. Un test que usa dos merchants uno detrás del otro prueba aislamiento, no necesariamente concurrencia de lectores de mismo merchant ni página «Ver ofertas».
- H04: abrir una PR documental es progreso, pero no hace que develop tenga la ficha actualizada. El build rojo en next/font de PR documental no prueba un defecto causado por docs.
- H05: fake en memoria sirve para validar semántica 500/501, no para prometer latencia real.
- Sin numerar AG nuevo sin máximo de todas las ramas remotas (no accesibles por clon en esta sesión).

## Ronda 4 — nueva regresión de test PR370-R01

**P08/P15 (R01):** para cumplir un pedido de probar concurrencia se introdujo una conciliación manual **antes** de la página que tenía que probar la materialización perezosa. Aunque E2E Preview quedó GREEN 79/79, el mismo test podría pasar si se quitara la conciliación del historial. La batería que demuestra un oráculo de lectura debe preservar un registro sin mutar y comprobar su estado en la base **inmediatamente antes de llamar al lector**; concurrencia sobre fixtures distintas no debe contaminarlo. Exigir mutación causal del código productivo (no de asserts) en copia temporal y RED/Green.

**Cuidado con la causalidad:** resolver `INVALID_STATE_TRANSITION` reordenando login antes de seed fue correcto; **no** atribuirlo a debilitar el backend. El test ahora cubre oferta expirada y concurrencia real, pero destruye su precondición del escenario de historial. Documentarlo como regresión del instrumento, no del producto.

**H04:** una ficha correcta en PR distinta no actualiza develop hasta su merge; el check `approval-policy` verde de PR370 no basta para PR377. Infraestructuras diferentes pueden tener check rojo por `next/font`; no alterar frontend para una PR docs-only sin diagnosticar causa.
