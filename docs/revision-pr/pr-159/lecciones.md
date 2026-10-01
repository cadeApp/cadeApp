# Lecciones — PR #159 (T-321)

## Ronda 1

No se agrega un número AG nuevo en esta ronda.

### PR159-H01 confirma reglas ya existentes

El defecto no necesita una regla nueva: es otra aparición de `P08-control-no-cubre-lo-que-dice`.

- **pr-64/AG-61:** una aserción de texto debe estar anclada a la unidad que dice proteger y hay que mutarla antes de confiar en ella.
- **pr-64/AG-63:** la mutación que valida el control conviene quedar escrita junto al control para que degradarlo vuelva rojo el CI.
- **pr-68/AG-75:** la batería de mutaciones de la verificación debe ser independiente de la del autor y atacar también lo que el arreglo agrega.

Acá el patrón aparece en dos capas: el pgTAP mide el estado final después del seed en vez de la garantía de migración, y la prueba de idempotencia vuelve a implementar `DO NOTHING` dentro del test en lugar de observar el `DO NOTHING` de la migración.

### PR159-H02

La evidencia real en staging no reveló una regla técnica nueva. Sí deja una advertencia para fichas futuras: cuando un DoD exige validar algo **después de desplegar una migración**, el punto temporal debe ser compatible con el workflow de promoción. En T-321 se resolvió por decisión explícita de Lautaro073: la evidencia AAL2 queda post-merge/post-promoción.

## Ronda 2

No se agrega AG nuevo.

### PR159-H03 confirma pr-68/AG-75 y corrige una falla de esta revisión

El autor implementó exactamente el checker pedido por la revisión de ronda 1 y mejoró de verdad el control: separó el seed, eliminó el SQL tautológico y dejó M01/M02 en CI.

El agujero nuevo lo introdujo **la sugerencia de la revisión**: validar `DO NOTHING` con una regex sobre el archivo completo. La batería de ronda 1 no probó un comentario señuelo, así que no vio que el regex no diferencia SQL ejecutable de comentario.

La nueva batería independiente M03 demuestra el falso verde. No hace falta una regla adicional porque **pr-68/AG-75** ya exige que la revisión ataque lo que el arreglo agrega; acá simplemente hay que aplicarla mejor. También vuelve a confirmar **pr-64/AG-61**: una aserción textual tiene que quedar anclada a la unidad semántica concreta que protege.
