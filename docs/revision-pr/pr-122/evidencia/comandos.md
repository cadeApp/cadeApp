# Evidencia y reproducciones — PR #122

## Ronda 6 — corrección del reviewer

Esta ronda no agrega evidencia de producto nueva. Corrige el criterio de revisión aplicado en Rondas 4–5.

### Regla del protocolo que se había incumplido

El prompt obligatorio para arreglos indica:

```text
Prohibido: docs/revision-pr/** (es de la revisión), marcar hallazgos como verificados,
crear archivos nuevos (los scripts auxiliares van en /tmp), dependencias nuevas,
editar la ficha, <lo que aplique>.
```

En Ronda 4 el reviewer pidió versionar un browser harness dentro de la rama. Esa instrucción fue incorrecta.

### Consecuencia

Se retiran del estado vigente:

```text
PR122-R04
PR122-R05
PR122-R06
PR122-R07
```

No se pide al autor corregirlos.

Las Rondas 4 y 5 permanecen en el historial para transparencia, pero **Ronda 6 supersede su veredicto**.

### Estado técnico que sí permanece

La ficha autoritativa en `develop` exige:

```md
- [ ] axe AA sin violaciones; objetivos de 48 px; `inputmode` numérico; Lighthouse móvil ≥ 80 en rendimiento y ≥ 95 en accesibilidad en crear solicitud, detalle con ofertas, lista del repartidor, onboarding y viaje; first-load JS dentro del presupuesto de la regla 25.
- [ ] Verificación con navegador a 390 px y 360 px, `prefers-reduced-motion`, teclado, contraste, sin scroll horizontal y capturas comparativas Stitch/implementación.
- [ ] Las primitivas de `src/ui/**` se auditan; cualquier cambio de contrato se deriva a `contract-change` separado y no se edita directamente en T-205.
```

En el SHA funcional de autor vigente esas casillas siguen en `[ ]`.

La bitácora declara expresamente:

```text
Lighthouse móvil: pendiente
axe AA: pendiente
```

Por eso `PR122-H03` permanece parcial y bloqueante.

### R03

Las PNG actuales fueron inspeccionadas por el reviewer y ya no muestran el clipping horizontal evidente que originó R03.

No se ejecutó una reproducción browser independiente; por eso el estado correcto es:

```text
arreglado-sin-verificar
```

y no `arreglado-verificado`.

### CI

No se consulta CI final mientras H03 siga abierto. El protocolo indica revisar CI recién cuando la ronda esté para aprobar.

### Próximo paso real

No hay corrección de código pedida por esta ronda.

Cuando exista un entorno adecuado para cerrar H03, la verificación deberá producir evidencia real de:

1. axe AA;
2. Lighthouse móvil en las cinco superficies;
3. browser 390/360 con reduced-motion, teclado/foco, contraste y overflow.

Los scripts auxiliares del reviewer, si hacen falta, se ejecutan desde `/tmp`; no se agregan a la rama del autor.
