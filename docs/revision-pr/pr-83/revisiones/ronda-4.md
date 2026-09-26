# PR #83 · T-115 — Ronda 4 independiente

- **SHA revisado:** `6a42a26675a8f6bb584e2eaa66c7fdf854bbf49e`
- **Resultado:** **CON BLOQUEANTES (8)**
- **CI:** no consultado por bloqueantes.
- **Checks completos independientes:** no ejecutados en checkout; los resultados 56/630 del autor siguen siendo evidencia del autor.
- **Decisiones pendientes:** ninguna.

## Autor escribió la carpeta de revisión

El commit `b805c947` fue escrito por `asako669` y modificó `docs/revision-pr/pr-83/**`, incluida una ronda propia que declara SIN BLOQUEANTES y estados verificados.

Por AG-36/COMO-ENTREGAR se conserva como `autorrevision-agy-r4.md`; los datos estructurados parten otra vez del último commit independiente.

## Lo que sí mejoró

H10, H15, H16, H17 y H21 mejoraron por inspección del head actual y quedan `arreglado-sin-verificar`.

### Corrección mía: H18 era falso positivo

En Ronda 3 conté `text-xs` como 12px. En este repo `tailwind.config.ts` redefine `text-xs` y `text-sm` a `0.875rem` (14px). H18 se cierra por corrección del revisor; eliminar `text-xs` no era necesario para Anti-12px.

## BLOQUEANTES

### H05 · Evidencia semántica rojo→verde no reproducible

La bitácora describe mutaciones, pero no conserva salida exacta rojo/verde ni harness reproducible. La auto-Ronda 4 no valida el trabajo del mismo autor.

### H13 · Query PostgREST todavía inválida / control proxy

`queries.ts` usa `pickup_zone:pickup_zone_id(name)` y `dropoff_zone:dropoff_zone_id(name)`. Supabase/PostgREST documenta `alias:relation!foreign_key(...)` cuando hay más de una FK a la misma relación. El mock solo rechaza seis columnas root: no observa la gramática de la relación.

No endurecer otro mock temporal. Tras mergear CC-008, reemplazar esta frontera por el wrapper/RPC autorizado.

### H14 · C06 contacta al cliente cuando dice contactar al cadete

`courierWaUrl` y el `tel:` del repartidor usan `recipientPhone`. Además el mensaje se arma ad hoc y no usa `buildTripCoordinationWhatsAppMessage`; R07 no tiene `merchantPhone` y avatar sigue pendiente.

Bloqueado por CC-008 #103.

### H19 · T05 sigue consumiendo el workaround

`TripCancelDialog` sigue sobre `DialogContent role="alertdialog"`. CC-009 #104 todavía no aporta la primitiva/token ejecutables.

Bloqueado por CC-009 #104.

### H20 · Capturas 390/360 ausentes

PR body y bitácora marcan el DoD visual como completado, pero no hay capturas/enlaces ni diferencias contra Stitch.

### H22 · Autorrevisión escribió el registro independiente

El commit `b805c947` modificó la carpeta de revisión y autoasignó estados verificados. La revisión lo preserva solo como contraste y restaura el registro independiente.

### H23 · PR body obsoleto

El body todavía menciona Google Maps y rutas `(merchant)/(courier)`, aunque ya fueron eliminados; también conserva 55/596 frente a 56/630 de la bitácora y marca capturas sin evidencia.

### H24 · Non-null assertions prohibidas

`TripMerchantView` usa `trip.amountArs!` dos veces. AGENTS.md §4 las prohíbe.

## Dependencias

- PR #103 / CC-008: Ronda 1 independiente con 3 bloqueantes.
- PR #104 / CC-009: Ronda 1 independiente con 3 bloqueantes.

T-115 no está listo para merge mientras esas dependencias sigan sin implementar/mergear.

## Mejora residual

H06: `Último commit: b805c94` no coincide con el head revisado `6a42a266`.
