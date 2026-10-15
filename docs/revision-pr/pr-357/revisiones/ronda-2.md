# Revisión independiente — PR #357 / T-361 — Ronda 2

**Fecha:** 2026-10-15. **SHA de implementación revisado:** `7909e3bca66e29980b3bd6bb9b3c536844143f1a` (no el nuevo commit de revisión). **Resultado: CON BLOQUEANTES — NO MERGEAR.** Sin decisiones nuevas: vigentes **1-C y 2-A**.

## Fuente de verdad y seguimiento

Se verificaron la ficha `docs/tasks/T-361.md` desde `develop`, las decisiones y ronda 1, el HEAD actual, bitácora, código de vistas, tests de componentes y E2E, comentario del agy y jobs de GitHub. HEAD remoto en la consulta: `7909e3b`. Base `develop`: `3b9f409` (integrado en la rama). La revisión mínima escrita anteriormente en la rama `docs/revisiones` es un antecedente **no autoritativo**; esta ronda se conserva aquí, en la rama del PR, conforme a la instrucción actual de Lautaro073. No se alteró código de la PR.

### PR357-R01 — BLOQUEANTE ALTO / REGRESIÓN CONFIRMADA

**Archivos origen:** `src/features/trips/components/trip-courier-view.tsx:281` y `src/features/trips/components/trip-merchant-view.tsx:252`. **Tests afectados (no tocar):** `e2e/specs/multi-drop.spec.ts:313` y `:723`. Ambos nuevos botones multi-drop imprimen como **texto visible** `Avisar a ${drop.recipientName}`. En la misma tarjeta también se muestra `Cliente: ${drop.recipientName}`. `page.getByText('Destinatario Uno MD')` y `...('Destinatario Uno Writer')` resuelven **dos nodos**: `<p>` y `<a>`; Playwright strict mode revienta. Reintentos 1/2 fallan igual. **Diagnóstico comprobado por los logs de Playwright del SHA**, no hipótesis preexistente: T-361 añadió la segunda coincidencia.

**Arreglo indicado:** conservar el CTA multi-drop para cada drop, pero mostrar **texto visible constante** «Avisar por WhatsApp» y añadir `aria-label={`Avisar a ${drop.recipientName} por WhatsApp`}` al enlace solo cuando haya más de uno. Para single-drop, no cambiar «Avisar a mi cliente». No mover nombres a `sr-only` ni `title` visible, que pueden seguir alterando el selector. Mantener `href`, teléfono normalizado, mensaje individual según `drop.status`, estado fallido, emisor, permisos, target y rel. El nombre sigue disponible para tecnología asistiva y en `getByRole('link',{name:/Avisar a Ana/})`. Adaptar `src/features/trips/components.test.tsx` con oráculo de texto visible **y** nombre accesible para comercio/cadete y los tres drops sin alterar fixtures ni aserciones viejas. Se conserva el E2E T-340 intacto.

**Demostración RED en CI:** run [38758120713](https://github.com/cadeApp/cadeApp/actions/runs/38758120713), job [116502029876](https://github.com/cadeApp/cadeApp/actions/runs/38758120713/job/116502029876) con checkout explícito de `7909e3b`: **76 passed, 2 failed**. E2E T-340 lector multi-drop en :313 y escritor en :723 fallan, también en dos reintentos, por estricta duplicación textual. El **Flujo 5 de T-361 pasa (33.2s)**. El objeto de GitHub `repository_dispatch` reporta `head_sha=3b9f409` porque la workflow es disparada desde develop, **pero el job ejecutó explícitamente `git checkout 7909e3b`**: esta distinción importa al citar la prueba.

## Seguimiento ronda 1

- **H01:** lógica de `dropStatus` incorporada, tests unitarios reportados verdes; **parcial** por regresión multi-drop global R01 pendiente.
- **H02:** función con `sender` explícito, comercio en tercera persona y cadete en primera, Flujo 5 E2E verde; **arreglado-verificado** en `7909e3b` por log E2E e inspección.
- **H03:** aserciones de importe/efectivo antiguo reemplazadas por copy correcto, Flujo 5 E2E verde; **arreglado-verificado** en `7909e3b`.
- **H04:** se ejecutó Preview y pasó el flujo específico T-361, pero **suite total falló**; **parcial**. No marcar DoD global.
- **H05:** API obliga `tripStatus` y `sender`, usa `dropStatus` opcional legacy; **arreglado-sin-verificar** hasta mutación independiente de su lógica.
- **H06:** bitácora agrega 12 errores RED y seis mutaciones narradas; no deja comandos íntegros, resúmenes individuales RED y contexto reproducible en el mismo SHA; **parcial**, no suplir con afirmación ficticia. El agy debe adjuntar evidencia auténtica o declarar límite.

## Checks / límites y alcance

- [CI](https://github.com/cadeApp/cadeApp/actions/runs/38757956210) sobre `7909e3b`: **success** (consultado por SHA).
- [E2E](https://github.com/cadeApp/cadeApp/actions/runs/38758120713) usa PR SHA según checkout (ver arriba) y falla **2** de **78** tests; la ausencia de fallos en el Flujo 5 no equivale a suite completa verde. Ningún test E2E viejo se debe debilitar.
- No hay permiso para editar `e2e/specs/multi-drop.spec.ts`; el arreglo cabe en `src/features/trips/**`, dentro de ficha.
- **Sin clon ejecutable ni pnpm en el entorno de revisión**: no se ejecutó Vitest local ni mutación independiente en un checkout. La prueba de regresión E2E es runtime real de CI; el resto solo se marca según evidencia indicada. Revalidar con nuevo SHA.
- `approval-policy` requiere aprobación vigente de Lautaro073, pero **no se solicita aprobación mientras haya bloqueantes**.

## Próxima acción

El prompt cerrado y copiable para agy, con exactos archivos/tests/RED/mutaciones/comandos, se publica **junto con este informe** en un único comentario de la PR. El agy trabaja en su propia rama, `git pull --ff-only` del nuevo commit de revisión, y solicita **ronda 3** una vez CI y E2E completos verdes. El revisor no aprobó ni mergeó.
