# Lecciones — PR #326

## PR326-L01 — No confundir «backfill ejecutado» con «cada valor está respaldado»

La existencia del llamado a `t340_backfill_legacy()` no garantiza cobertura total porque filtra borradores incompletos y casos no materializables. Si el paso siguiente borra globalmente valores legacy, destruye potencialmente información. Exigir un **preflight de cobertura por fila y valor**, con separación drafts/no-drafts, y atomicidad del plan entero. El mismo principio rige el puente al publicar cuando existen drops previos.

## PR326-L02 — GREEN de pgTAP no reemplaza la prueba de transición de esquema

Un test ejecutado **después** de aplicar la migración sobre fixtures limpios puede dejar fuera el riesgo principal: el estado histórico **antes** de correr el SQL. Probar esa frontera con dataset antiguo, errores controlados, idempotencia y mutación negativa que reproduzca la limpieza indebida. No certificar RED sin una ejecución real.

## PR326-L03 — La autorización del alcance debe quedar trazable

Kira recibió permiso puntual del responsable P1 para SQL/RPC del Paso 3 y para `staging-seed.test.ts`; no es permiso general para otras tareas, Paso 4, trabajar sobre remoto manualmente o debilitar políticas. Registrar la decisión en la revisión y en el body evita rondas por un supuesto desvío ya resuelto.

*Identificadores locales PR326-Lxx usados para no colisionar con secuencias AG globales cuya última numeración remota no se verificó en esta sesión.*

## Ronda 2 — Los negativos ejecutados deben ser de la propiedad revisada

Un CI puede mostrar RED→GREEN auténtico, pero si corresponde a H13/H14 (controles de roles y locks de otra tarea), no prueba la calidad de H01–H03 (pérdida de datos en limpieza). La «evidencia RED→GREEN analítica» es una predicción, no una ejecución. Al validar un arreglo de corrupción irreversible, exigir mutación negativa del UPDATE global **realmente ejecutada** sobre datos artificiales, no un rojo lógico por lectura del SQL.

El test de idempotencia debe comparar el estado completo antes/después; un helper que devuelve `1` tras una llamada y prueba `1 = 1` solo mide ausencia de excepción, no inmutabilidad de datos.

## Ronda 3 — La cobertura solo cuenta cuando el pipeline alcanza la prueba

Una mutación RED instrumentada en un script no equivale a RED ejecutado: si una aserción previa de pgTAP falla por un literal que no coincide con su fixture, CI se corta antes del runner mutador. Contrastar **have/want del test exacto**, corregir el test usando el fixture real o una captura previa, exigir GREEN general y recién después pedir salidas RED→GREEN de cada mutante.

El runner `t340_concurrency.mjs` está autorizado en la ficha solo Paso 1, aunque su ruta figure entre archivos permitidos. Ampliarlo para mutaciones H01/H02 puede tener mérito técnico (pipeline existente), pero **requiere aprobación específica**; cambiar tests de otra fase sin permiso no se convierte en válido solo por ser útil.

## Ronda 4 — Una corrección mínima del oráculo puede ser legítima

Cuando una aserción falla exclusivamente por un literal imposible dado el fixture conocido (`recipient_name='Dest Historico'` frente a `want='Dest Historico Integro'`), corregir la expectativa a la fuente puede ser válido siempre que **se mantenga la aserción, la entrada y la propiedad** y después se exija CI real GREEN. No cambiar fixtures para coincidir con una prueba defectuosa ni eliminar verificaciones.

**Señal fuerte de mutación:** exit no cero + `# Failed test N` del invariante exacto + restauración de la función en `finally` + rerun misma suite con exit 0. El simple texto del nombre de test en cualquier lugar de la salida no era suficiente (corregido en R4). La revisión debe verificar la salida completa de Actions, no fiarse de la narración del autor. Para ser transparente: acá se inspeccionó la batería redactada por Kira y realmente ejecutada por CI; no se ejecutó un segundo mutador propio con Docker.
