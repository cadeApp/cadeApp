# PR #122 — T-205 — Ronda 6 (corrección del reviewer)

**Fecha:** 2026-09-29  
**SHA funcional de autor vigente:** `bae8c771e2a42c20a45764cc984fefb5265de160`  
**Resultado:** **CON BLOQUEANTE (1)**

> Esta ronda no responde a cambios nuevos del autor. Corrige un error de proceso del reviewer detectado después de cerrar la Ronda 5.

## Error del reviewer

El prompt obligatorio de revisión establece que, cuando se piden correcciones al agy:

- no se crean archivos nuevos;
- los scripts auxiliares van en `/tmp`;
- se debe indicar exactamente qué tocar y qué no tocar.

En Ronda 4 el reviewer pidió versionar dentro del PR un harness browser y su configuración. Eso fue incorrecto y contradijo el protocolo que debía seguir.

Las Rondas 4–5 terminaron evaluando ese harness versionado como si fuera un entregable obligatorio del autor. No correspondía.

## Corrección de estado

Se retiran del estado vigente:

- `PR122-R04`
- `PR122-R05`
- `PR122-R06`
- `PR122-R07`

No deben usarse para pedir otra ronda ni para bloquear el merge por sí mismos.

Los archivos/harness añadidos a partir de esa instrucción no se usan como condición de aprobación en esta revisión corregida. Esta ronda no exige que el autor los modifique, mejore o retire.

## Hallazgos válidos restantes

### H01 — arreglado-sin-verificar

La inspección de código mostró que los targets, headings y animaciones enumerados fueron corregidos. No se ejecutó una reproducción runtime independiente en el SHA, así que no se marca verificado.

### H02 — arreglado-sin-verificar

Los proxies falsos y regresiones de inputmode fueron corregidos por inspección. Las mutaciones declaradas por el autor no fueron reproducidas por el reviewer.

### H03 — parcial y único bloqueante vigente

La ficha oficial de `develop` exige:

- axe AA sin violaciones;
- Lighthouse móvil >=80 rendimiento y >=95 accesibilidad;
- las cinco superficies: crear solicitud, detalle con ofertas, lista del repartidor, onboarding y viaje;
- browser 390/360;
- prefers-reduced-motion;
- teclado/foco;
- contraste;
- sin scroll horizontal;
- capturas;
- auditoría de primitivas `src/ui/**`.

En el HEAD de autor esas casillas siguen en `[ ]`.

La bitácora además declara expresamente:

- Lighthouse móvil: pendiente;
- axe AA: pendiente.

Eso es correcto y honesto, pero significa que T-205 **todavía no cumple el DoD completo**.

Las capturas T-205 actuales ya no muestran el clipping horizontal detectado originalmente en R03; por eso R03 deja de ser un bloqueante actual. No obstante, el reviewer no ejecutó el browser audit real ni axe/Lighthouse, así que esa parte permanece dentro de H03.

### H04 — arreglado-sin-verificar

La trazabilidad de commits fue corregida.

### R01 / R02 — arreglados-sin-verificar

- ficha autoritativa restaurada;
- non-null assertions retiradas.

### R03 — arreglado-sin-verificar

El defecto visual concreto que motivó R03 —capturas con clipping horizontal evidente— ya no aparece en las PNG actuales inspeccionadas por el reviewer.

## CI

No se revisa CI final todavía. El protocolo indica mirarlo recién cuando la ronda está para aprobar y H03 sigue bloqueando por criterios runtime pendientes.

## Qué debe hacer el autor ahora

**Nada por R04–R07.** Esos puntos quedan retirados porque nacieron de una instrucción errónea del reviewer.

T-205 queda pendiente exclusivamente de completar H03 cuando exista el entorno adecuado para:

1. axe AA real;
2. Lighthouse móvil real;
3. verificación browser autenticada del DoD.

No se pide una nueva corrección de código en esta ronda.
