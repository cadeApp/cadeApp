# Lecciones — PR #242 (T-325 hotfix)

## Ronda 1

No se propuso AG nueva. H01/H03 repiten P08 y H02 P06.

## Ronda 2

Los tres defectos técnicos quedaron cerrados. Aparece un único patrón de proceso:

- **H04** no necesita regla nueva: `revisar-pr` ya dice que checks sin evidencia pegada o bitácora sin sesión final son bloqueantes.
- El dato útil es que un commit puede estar técnicamente correcto y CI puede estar completamente verde, pero el cuerpo/bitácora seguir describiendo el SHA anterior. Es una variante de `P03-comentario-contradice-codigo`.

### Flaky ajeno

El E2E exact-head de T-325 expuso un flaky en T-303 al esperar salir de `/login`. Como la regla 40 obliga a registrar pruebas inestables en vez de confiar en retries, se abrió **issue #245**. No se carga como hallazgo de PR #242 porque no toca sus archivos ni su comportamiento.

## Sin AG nueva

La prevención ya existe:

1. cerrar sesión append-only después del último commit funcional;
2. actualizar el cuerpo con outputs del SHA actual;
3. no confundir CI verde con evidencia manual cuando la PR declara esa verificación pendiente.
