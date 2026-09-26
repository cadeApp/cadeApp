# PR #83 · T-115 — Ronda 6 independiente

- **SHA revisado:** `a1914d49fabb7276cba5040449852a55810edb65`
- **Resultado:** **SIN BLOQUEANTES**
- **Decisiones pendientes:** ninguna.
- **develop:** `bdafee8ff04d6b620eb46dd885b62fe0d675ca49`
- **Rama:** ahead 29 · behind 0.
- **CI #430:** build ✅ · typecheck ✅ · db-tests ✅ · lint ✅ · audit ✅ · unit ✅ · bundle-budget ✅.
- **Unit:** 59 archivos / 670 tests.
- **Build:** `/trips/[id]` dinámica, 186 kB first load; bundle-budget verde.

## Preflight y proceso

La PR es de P2. Según `docs/revision-pr/COMO-ENTREGAR.md` vigente, esta ronda se guarda en `docs/revisiones`; no se escribe sobre la rama de agy.

Desde la Ronda 5:
- `a8bcad1` mergeó `origin/develop` sin rebase/force;
- `a1914d49` solo cambió bitácora, evidencia PNG y eliminó el generador/HTML estáticos;
- el autor no volvió a tocar `docs/revision-pr/pr-83/**`.

## H20 · CERRADO Y VERIFICADO

Se abrieron directamente las seis PNG del SHA final:

```text
c06_merchant_390x844.png
c06_merchant_360x800.png
r07_courier_390x844.png
r07_courier_360x800.png
t05_cancel_390x844.png
t05_cancel_360x800.png
```

### C06
En 390 y 360 aparecen:
- WhatsApp y Llamar al cadete;
- Avisar a mi cliente;
- **El repartidor no llegó**;
- **Cancelar envío**.

No se observa overflow horizontal. La variante 360 trunca visualmente el nombre largo del repartidor para preservar el layout, sin ocultar la identidad funcional ni los CTAs.

### R07
En ambas medidas aparecen:
- WhatsApp al comercio;
- Llamar;
- Cobrás al entregar;
- No puedo hacer este viaje;
- **Marcar como retirado habilitado**.

El CTA sticky ya no aparece disabled y queda visible dentro del viewport.

### T05
El diálogo se muestra sobre la pantalla real, con:
- título/descripción;
- radiogroup de motivos;
- Continuar inicialmente disabled hasta elegir motivo;
- Volver;
- modal completo dentro de 390 y 360.

Además:
- `src/features/trips/render-previews.test.tsx` fue eliminado;
- los tres HTML estáticos fueron eliminados;
- la bitácora documenta Next.js corriendo + Edge CDP en la ruta canónica.

H20 pasa a `arreglado-verificado`.

## H25 · CERRADO Y VERIFICADO

Compare actual:

```text
develop...feat/T-115-vista-de-viaje
status: ahead
ahead: 29
behind: 0
merge-base: bdafee8ff04d6b620eb46dd885b62fe0d675ca49
```

Workflow #430:

```text
event: pull_request
head: a1914d49fabb7276cba5040449852a55810edb65
base: bdafee8ff04d6b620eb46dd885b62fe0d675ca49
conclusion: success
```

Todos los jobs están verdes. H25 pasa a `arreglado-verificado`.

## Revalidación de hallazgos históricos

El registro todavía tenía arreglos viejos en `arreglado-sin-verificar`. Se revalidaron antes de cerrar:

- **H01:** las 6 actions afirman RPC + payload exactos y una sola llamada.
- **H02:** matriz completa de autenticación/rol para las 6 actions.
- **H03:** no-show prueba el default omitiendo `republish` y exige `republish:true` en la RPC.
- **H04:** ambos mensajes usan sentinelas/allowlist y prueban ausencia de PII extra.
- **H07:** body/ficha de rama reflejan las decisiones D02–D05; D02 autoriza la ruta canónica.
- **H08:** las 6 actions cubren `INVALID_STATE_TRANSITION`.
- **H09:** existe frontera de query y hoy delega al contrato real CC-008, no a un mock PostgREST inventado.
- **H11:** cada happy path afirma invalidación de `/trips/<id>` y feed/dashboard correspondiente.
- **H12:** tests de teléfono cubren 7/8/9, 10 válido, 11+, 0/15, +54 y +54 9.
- **H15:** barrido completo sin Google Maps ni coordenadas T-117.
- **H16:** una sola ruta `src/app/trips/[id]` y revalidaciones canónicas.
- **H17:** mapeos canónicos walk/bike/moto/car y cash/transfer/to_agree.
- **H21:** `amountArs` es `number` obligatorio; no hay `?? 0`, `$ 0` ni “Monto a confirmar”.

Todos quedan `arreglado-verificado` en el SHA final.

## Barrido de clase completa

Se revisaron los 25 archivos `.ts/.tsx` bajo:
- `src/features/trips/**`
- `src/app/trips/**`
- `src/lib/whatsapp.ts`

Resultado:

```text
.only/.skip               0
setTimeout/sleep          0
any                       0
@ts-ignore                0
Maps/coordenadas T-117    0
hex #RRGGBB               0
import directo sonner     0
```

## Scope

El commit propio final `a1914d49` toca únicamente:
- `docs/tasks/log/T-115.md`;
- evidencia dentro de `src/features/trips/evidence/T-115/**`;
- eliminación de `src/features/trips/render-previews.test.tsx`.

Los demás archivos compartidos llegaron exclusivamente por el merge de `develop`.

## Dictamen

**SIN BLOQUEANTES.** No se detectaron mejoras residuales ni decisiones nuevas.

No se aprueba ni mergea desde esta revisión; la decisión final queda en Lautaro073.
