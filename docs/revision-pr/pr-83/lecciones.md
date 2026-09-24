# Lecciones — PR #83 / T-115

Fuente: ronda 1 sobre `4b4f18b`. Numeración continua desde AG-64.

## Patrón dominante

`P08-control-no-cubre-lo-que-dice` reaparece fuera de SQL: resultado del mock como proxy de RPC invocada, blacklist como proxy de allowlist y rojo de infraestructura como proxy de mutación real.

## AG-64 · Una Server Action se prueba por la llamada que hace y por lo que devuelve

**Origen:** H01.

> Si la RPC está mockeada, cada happy path afirma operación, input y resultado. El resultado solo no demuestra el cableado.

## AG-65 · La autorización de actions se revisa como matriz action × actor

**Origen:** H02.

> Enumerar para cada action `sin sesión` y `rol incorrecto` antes de cerrar la ronda; un guard probado en otra action no protege esta.

## AG-66 · Un booleano opcional tiene tres casos: omitido, true y false

**Origen:** H03.

> Si el default cambia comportamiento, probar los tres valores semánticos. Un test que pasa `true` no prueba el default.

## AG-67 · Privacidad se prueba con sentinelas, no con blacklist

**Origen:** H04.

> Cargar datos prohibidos como `SENTINEL_*` en un objeto deliberadamente más ancho y afirmar que ninguno aparece. La blacklist solo cubre lo que alguien recordó nombrar.

## AG-68 · Un rojo por infraestructura no valida el control

**Origen:** H05.

> La evidencia del principio 8 debe decir qué propiedad se mutó y qué aserción cayó. Import/setup/conexión rojos son fase inicial, no validación del test.

## AG-69 · La regla de privacidad debe expresar el trust boundary

**Origen:** D01.

> No mezclar fuga hacia actores no autorizados con uso de un dato por quien ya puede leerlo. Documentar la excepción `wa.me/<recipient_phone>` para actor autorizado por RLS, manteniendo prohibidos logs, analytics y push.

## Advertencias

- H01–H05 aparecieron antes de implementar: es el momento barato para corregirlos.
- D01 fue decidida por Lautaro073 antes del informe y no autoriza tocar `AGENTS.md` dentro de T-115.
- No se modifica `AGENTS.md` automáticamente desde esta ronda; la corrección global queda separada.
