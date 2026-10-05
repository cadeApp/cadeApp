# Informe de revisión — PR #224 / T-308 — Ronda 4

**SHA revisado:** `593c2b845fa30f7e43666d993f27679f53d8560b`  
**develop actual:** `1cd3da01b3af9619e4a19107ba5e8354a18c2159`  
**Sincronización:** behind=4  
**Fecha:** 2026-10-05

## Resultado

**CON 4 BLOQUEANTES: H03, H04, H05 y H06.**

No hay decisiones 🔵 para P1.

El Preview volvió a funcionar. El CI normal quedó completamente GREEN, pero el gate E2E real sigue RED.

---

## Gate real

Sobre `593c2b8`:

```text
Vercel:       success
CI:           success
e2e-preview:  failure
run:          37334483825
resultado:    23 passed / 1 failed
```

DoD 2, DoD 3 y DoD 4 vuelven a quedar verdes.

Único rojo:

```text
DoD 1: El reporte llega a la bandeja de administración

Locator: getByText(/recibimos tu reporte/i)
Expected: visible
Received: <element(s) not found>
incidents.spec.ts:77
```

---

## PR224-H06 — NUEVO · MEDIO · BLOQUEANTE

El fallo no es otro copy desactualizado.

El reporte **no llega a enviarse**. El artefacto `playwright-report` del run `37334483825` (artifact `11356730870`) muestra, en los tres intentos, el formulario todavía abierto y este error de validación:

```text
Sacá los teléfonos o correos del relato: no se pueden compartir datos de contacto.
```

El valor del textarea es:

```text
Incidente E2E e2e_1791215...: El repartidor tuvo un problema con el cobro acordado.
```

La causa está en el propio spec:

```ts
const incidentDescription =
  `Incidente E2E ${stagingContext.testRunId}: El repartidor tuvo un problema con el cobro acordado.`;
```

Y el contrato CC-012 define como teléfono:

```ts
/\+?\d(?:[\s.()-]*\d){6,}/
```

es decir, 7 o más dígitos. El `testRunId` trae una secuencia temporal de 13 dígitos, así que el fixture E2E viola exactamente la regla que el formulario debe aplicar.

**No hay que cambiar el schema, el copy ni la RPC. Hay que corregir el dato del test.**

Barrido de la clase: el `testRunId` también aparece en dos `p_reason` de suspensión, pero esos campos no pasan por el schema de relato CC-012. El caso problemático de esta clase dentro de T-308 es el `incidentDescription`.

Este agujero también es de la revisión anterior: en R2/R3 se revisaron selectors y MFA, pero no se contrastó el relato sintético con el contrato CC-012.

---

## H05 — ARREGLADO-SIN-VERIFICAR

El run real sí demuestra que:

- encuentra y selecciona `Problema con el cobro`;
- encuentra `¿Qué pasó?`;
- llena el textarea;
- llega a intentar el submit.

Por lo tanto, los primeros selectores corregidos ya no son el bloqueo.

Todavía no puede verificarse el selector de éxito ni el de bandeja porque H06 impide crear el incidente.

---

## H03 — ARREGLADO-SIN-VERIFICAR

Sigue sin ejecutarse el tramo MFA porque DoD 1 corta antes, en validación del relato.

Además, desde la última sincronización entró T-336 a develop, que modifica `src/features/auth/guards.ts` y mueve/ajusta middleware. Por AG-71, H03 debe probarse después del próximo merge de develop.

---

## H04 — PARCIAL

Ahora ya no existe el bloqueo de infraestructura, pero el baseline final sigue RED por H06. No corresponde ejecutar ni contar M1–M4 mientras el caso sano no pase.

Orden correcto:

1. integrar develop actual;
2. corregir H06;
3. obtener baseline GREEN de DoD1–4;
4. ejecutar las mutaciones RED;
5. revertirlas;
6. obtener GREEN final.

Para reducir consumo de deployments después del rate limit, las cuatro mutaciones pueden ejecutarse en **un único commit temporal** siempre que el mismo run muestre que **cada uno de los cuatro tests nombrados queda RED por su propiedad específica**. Luego revert normal y GREEN final. Si un test no queda rojo por la causa esperada, esa mutación no cuenta.

---

## CI normal

Run `37334306037` sobre `593c2b8`:

```text
db-tests        success
lint            success
typecheck       success
build           success
audit           success
unit            success
bundle-budget   success
```

CI normal completamente GREEN.

---

## Sincronización

`develop` avanzó 4 commits:

- T-305 E2E autorización;
- T-336 navegación/auth/middleware;
- T-307 E2E notificaciones/realtime;
- T-337 ficha de hidratación de LoginPage.

La rama quedó `behind=4`. T-336 es material para H03, por lo que debe integrarse antes del próximo gate.

**NO MERGEAR.**
