# PR #83 · T-115 — Ronda 3

- **SHA revisado:** `8bc4ee282c11f193c117885404fc2652b8ae820f`
- **Fecha:** 2026-09-25
- **PR:** #83 · `feat/T-115-vista-de-viaje` → `develop`
- **Autor:** `asako669` · P2
- **Resultado:** ❌ **CON BLOQUEANTES — 11**
- **Decisiones:** D02–D05 resueltas por Lautaro073 antes de cerrar la ronda.
- **CI:** no consultado porque hay bloqueantes.
- **Checks completos del repo:** no ejecutados de forma independiente; el entorno no dispone de checkout/pnpm. Los `55/55` suites y `596/596` tests son evidencia del autor, no verificación de esta revisión.

## Preflight y alcance

El head permaneció estable durante la ronda en `8bc4ee28`. Se relevaron comentarios, threads y `docs/tasks/log/T-115.md` antes de cerrar.

La comparación normal contra `develop` aparece `ahead 13 / behind 13` porque la rama fue rebaseada y luego mezcló el remoto anterior. Ese rebase se hizo por una **instrucción equivocada de mi Ronda 2**; no se atribuye como hallazgo a P2. Para revisar alcance se usó además el último ancestro compartido funcional `2a096317`, donde el delta propio de T-115 queda limitado a `src/features/trips/**`, las rutas `trips/**` de los dos route groups, `src/lib/whatsapp.ts`, bitácora y documentación de revisión.

**A partir de ahora no rebasear esta rama.** La próxima sincronización debe ser `git merge origin/develop`, sin force/amend.

## Arreglos anteriores que mejoraron

P2 corrigió correctamente en código, aunque esta sesión no pudo ejecutar Vitest, los siguientes puntos: H01, H02, H03, H04, H07, H08, H09, H11 y H12. Quedan registrados como `arreglado-sin-verificar`, no como verificados.

- H01: 6/6 happy paths afirman RPC, payload y una llamada.
- H02: matriz 6×{sin sesión, rol incorrecto} presente.
- H03: el default de no-show se prueba omitiendo `republish`.
- H04: builders probados con `SENTINEL_*`.
- H07: cuerpo del PR actualizado al DoD vigente.
- H08: 6/6 actions cubren `INVALID_STATE_TRANSITION`.
- H09: existe suite de query; su mock no valida el esquema real y por eso nace H13.
- H11: 2 `revalidatePath` por happy path; las rutas deberán cambiar por D02.
- H12: validación a 10 dígitos y bordes/prefijos cubiertos.

H05 sigue abierto. H06 mejoró pero el SHA de bitácora sigue sin corresponder al remoto. H10 queda parcial: hay 15 tests visuales, pero no prueban foco, el empty no está integrado y el no-show del comercio no expone pending.

## BLOQUEANTES

### H05 · La evidencia roja sigue sin demostrar mutaciones semánticas

`862ac52` agrega tests cuando los módulos de producto todavía no existen. La bitácora afirma que hubo mutaciones semánticas, pero no conserva un comando/salida reproducible que muestre qué propiedad se rompió y qué aserción cayó.

**Corrección:** para cada control relevante de esta ronda, conservar rojo→verde real; import/setup rojo no cuenta.

### H10 · Cobertura visual todavía parcial

`components.test.tsx` tiene 15 tests pero 0 aserciones de foco. `TripEmptyState` no es consumido por ninguna página —las páginas llaman `notFound()`— y el botón “El repartidor no llegó” no recibe `isPending`/disabled, por lo que el estado de envío pendiente no está cubierto en ese flujo.

**Corrección:** probar foco real, integrar un empty real o justificar el `not-found` equivalente, y bloquear/mostrar pending durante no-show.

### H13 · `getTripDetails()` consulta un esquema que no existe

`src/types/database.types.ts` de `develop` demuestra:

- `delivery_requests` **no** tiene `code`, `pickup_address`, `pickup_lat`, `pickup_lng`, `dropoff_lat` ni `dropoff_lng`;
- esos exactos viven en `delivery_request_contacts`;
- `delivery_request_contacts` **no** tiene `delivery_notes`;
- `offers.courier_id` referencia `couriers.profile_id`, no `profiles` directamente;
- `profiles` no tiene `vehicle_type`, `vehicle_plate` ni `avatar_url`.

El mock de `queries.test.ts` ignora completamente la proyección pasada a `.select()`. La reproducción independiente quedó verde incluso con `columna_que_no_existe` y `totally_invalid(*)`. En Supabase real la query actual falla y `getTripDetails()` termina devolviendo `null`.

**Corrección:** reconstruir la query desde el esquema real. Por D04 el código visual se deriva del UUID, no se crea columna. Los datos de identidad/contacto que el esquema/RLS aún no permite dependen de D03.

### H14 · El botón de contacto al cadete usa el teléfono del cliente

En C06:

```ts
const courierWaUrl = trip.recipientPhone ? buildWhatsAppUrl(trip.recipientPhone, ...) : '#'
```

y el `tel:` de la tarjeta del repartidor también usa `recipientPhone`. El test actual incluso exige `5493865123456`, que es el teléfono del destinatario del fixture.

Además, la vista no renderiza el avatar y R07 no dispone del contacto al comercio. El esquema/RLS vigente no ofrece de forma segura esos datos cruzados.

**Corrección:** D03 quedó resuelta: abrir CC con proyección mínima post-`matched` para `merchantPhone`, `courierPhone`, identidad/vehículo/patente y avatar seguro. No abrir `profiles`/`couriers` completos.

### H15 · T-115 adelantó trabajo reservado a T-117

La ficha T-115 dice explícitamente `mapa reservado para T-117`; T-117 tiene como objetivo propio el mapa, coordenadas y “Abrir en Google Maps”. Sin embargo T-115:

- transporta cuatro coordenadas en `TripDetails`;
- las consulta en `getTripDetails`;
- construye `google.com/maps/dir` en R07;
- tiene un test que exige ese botón.

**Corrección:** retirar coordenadas y navegación Google Maps de T-115. T-117 las agrega después con sus tests de privacidad/fallback.

### H16 · Las dos páginas de route groups colisionan en `/trips/[id]`

Existen:

- `src/app/(merchant)/trips/[id]/page.tsx`
- `src/app/(courier)/trips/[id]/page.tsx`

Los route groups entre paréntesis no forman parte de la URL, por lo que ambas definen el mismo `/trips/[id]`. Además T-114 ya navega a `/trips/${requestId}` y `route-integrity.test.ts` documenta ese destino como contrato de T-115.

**Corrección — D02:** una sola `src/app/trips/[id]/page.tsx` decide la vista por sesión/rol. Lautaro073 autoriza agregar `src/app/trips/**` a “Archivos permitidos” de T-115. Las invalidaciones pasan también a `/trips/${requestId}`.

### H17 · Los labels no usan los enums reales

El dominio real usa `walk | bike | moto | car`; C06 usa `motorcycle ? 'Moto' : 'Bicicleta'`. Resultado de la reproducción actual:

```text
walk -> Bicicleta
bike -> Bicicleta
moto -> Bicicleta
car  -> Bicicleta
```

R07 hace `cash ? Efectivo : Transferencia`, por lo que `to_agree` aparece como “Transferencia”. Los fixtures usan `motorcycle/bicycle`, los mismos valores fantasma que el componente.

**Corrección:** mapear exhaustivamente los enums canónicos y testear todas las variantes.

### H18 · 18 usos de `text-xs` violan Anti-12px

Barrido completo de `src/features/trips/components/**`:

```text
trip-merchant-view.tsx  6
trip-courier-view.tsx  10
trip-cancel-dialog.tsx  1
trip-error-state.tsx    1
TOTAL                  18
```

`implementation-plan.md §12.2` fija piso `text-sm`/14px para comercio y repartidor.

**Corrección:** reemplazar todo `text-xs` por tipografía permitida y agregar un control que falle al reintroducirlo.

### H19 · T05 y WhatsApp evitan el CC obligatorio

T05 se implementó con `<DialogContent role="alertdialog">` aunque falta la primitiva compartida requerida. El botón WhatsApp usa `bg-[#25D366]` y `hover:bg-[#20ba5a]`, valores arbitrarios prohibidos por regla 60.

**Corrección — D05:** abrir CC liviano de UI que agregue `AlertDialog` y un token semántico WhatsApp. T-115 consume esas piezas después; no edita `src/ui/**` directamente.

### H20 · El PR marca capturas/navegador como completados sin evidencia

El cuerpo marca `[x]` la verificación real a 390/360 y diferencias respecto de Stitch. No hay enlaces/capturas ni en cuerpo, comentarios ni bitácora, y la directiva visual exige conservarlos.

**Corrección:** ejecutar navegador real a 390 y 360, verificar estados/foco/targets, adjuntar capturas y documentar diferencias deliberadas.

### H21 · `amountArs:null` se convierte silenciosamente en `$0`

C06 construye el mensaje al cliente con `trip.amountArs ?? 0`; R07 también muestra `$ 0` cuando falta el monto. D14 exige comunicar/cobrar el monto de la oferta aceptada: cero no es fallback válido.

**Corrección:** después de `matched`, el contrato debe exigir oferta aceptada + monto no nulo. Ante inconsistencia, no renderizar un monto inventado; retornar error/empty controlado. Agregar mutación `acceptedOffer missing/null`.

## MEJORA pendiente

### H06 · SHA de bitácora

La contradicción “PR abierta / falta abrir PR” ya se corrigió, pero `Último commit: fb8feb0` no coincide con el head remoto `8bc4ee28`. Actualizar al cierre siguiente con un SHA realmente pusheado.

## 🔵 DECISIONES — TODAS RESUELTAS POR LAUTARO073

- **D01 (previa):** `recipient_phone` puede ir en `wa.me` post-RLS para actor autorizado.
- **D02 · 1-A:** ruta compartida `/trips/[id]`; se autoriza `src/app/trips/**` en T-115.
- **D03 · 2-A:** CC de datos con proyección mínima y segura post-match para contactos/identidad/avatar; no abrir tablas completas.
- **D04 · 3-A:** código visual derivado del UUID (`REQ-…`); no agregar `delivery_requests.code`.
- **D05 · 4-A:** CC liviano de UI con `AlertDialog` + token semántico WhatsApp.

## Orden recomendado para la corrección

1. Pullear este commit de revisión con `--ff-only`.
2. `git fetch origin && git merge origin/develop` — **sin rebase, force ni amend**.
3. Actualizar la ficha T-115 solo con la ampliación autorizada `src/app/trips/**` y reflejar D02–D05 en bitácora/PR.
4. Abrir los dos CC resueltos: datos (D03) y UI (D05). No mezclarlos dentro de T-115.
5. Mientras los CC se revisan, resolver H05, H10, H13 en lo no dependiente del CC, H15, H16, H17, H18, H20 y H21.
6. Tras mergear los CC, terminar H14/H19 y ejecutar todo el rojo→verde específico.
7. Browser 390/360 + capturas.
8. `pnpm typecheck && pnpm lint && pnpm test` y checks específicos.
9. Actualizar bitácora con SHA remoto y pedir Ronda 4.

## Checks de esta revisión

- `CI`: no consultado por bloqueantes.
- `pnpm typecheck/lint/test`: no ejecutados independientemente por falta de checkout/pnpm.
- `test:db`: no aplica al diff actual; los CC futuros sí deben traer sus propios controles de contrato/RLS según el área tocada.
- Harness Node aislado: H13, H14, H17 y conteo H18 reproducidos.
- Ficha T-115 leída desde `develop`; no está modificada en el head revisado.
