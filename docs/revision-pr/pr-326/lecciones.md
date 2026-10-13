# Lecciones — PR #326

## PR326-L01 — No confundir «backfill ejecutado» con «cada valor está respaldado»

La existencia del llamado a `t340_backfill_legacy()` no garantiza cobertura total porque filtra borradores incompletos y casos no materializables. Si el paso siguiente borra globalmente valores legacy, destruye potencialmente información. Exigir un **preflight de cobertura por fila y valor**, con separación drafts/no-drafts, y atomicidad del plan entero. El mismo principio rige el puente al publicar cuando existen drops previos.

## PR326-L02 — GREEN de pgTAP no reemplaza la prueba de transición de esquema

Un test ejecutado **después** de aplicar la migración sobre fixtures limpios puede dejar fuera el riesgo principal: el estado histórico **antes** de correr el SQL. Probar esa frontera con dataset antiguo, errores controlados, idempotencia y mutación negativa que reproduzca la limpieza indebida. No certificar RED sin una ejecución real.

## PR326-L03 — La autorización del alcance debe quedar trazable

Kira recibió permiso puntual del responsable P1 para SQL/RPC del Paso 3 y para `staging-seed.test.ts`; no es permiso general para otras tareas, Paso 4, trabajar sobre remoto manualmente o debilitar políticas. Registrar la decisión en la revisión y en el body evita rondas por un supuesto desvío ya resuelto.

*Identificadores locales PR326-Lxx usados para no colisionar con secuencias AG globales cuya última numeración remota no se verificó en esta sesión.*
