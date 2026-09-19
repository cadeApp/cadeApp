# 02 — Comercio o emprendedor

Tipo de dispositivo: **Mobile**. Cada prompt va precedido por el Bloque de estilo de `00-sistema-de-diseno.md`.

Navegación común del comercio: barra inferior fija con tres ítems (**Inicio**, **Historial**, **Cuenta**).

Reglas de estas pantallas:
- Antes de aceptar una oferta, el repartidor no ve la dirección, el nombre ni el teléfono del destinatario (D3).
- El envío lo paga el destinatario al recibir (D14).
- Las insignias "verificada" aparecen solo si el admin revisó el comprobante (§6.4).

## C01 — Alta del negocio

```prompt
Screen: merchant onboarding after sign up, titled "Contanos de tu negocio". A progress bar showing step 2 of 2.
Form fields with labels:
- "Nombre del negocio" (example value "Panadería La Espiga")
- "Teléfono de contacto" (example "381 555-0123") with helper text "Lo ve solo el repartidor que elijas."
- select "Barrio de retiro habitual" (value "Centro")
- "Dirección de retiro habitual" (example "San Martín 450") with helper text "Se completa sola en cada solicitud. Podés cambiarla."
- Card "Ubicación del local en el mapa": an interactive map card of Aguilares with a fixed teal pin in the center and a crosshair, helper text "Mové el mapa para marcar la puerta de tu negocio. Muy útil si tu calle no tiene número.", and a 48 px outline button with a crosshair icon "Usar mi ubicación actual".
A teal-tinted info card: "Estás en el piloto gratis. Cuando termine te vamos a avisar cómo seguir."
Checkbox "Acepto los Términos del piloto" with the words as a link.
Primary full-width sticky bottom button "Empezar".
```

**Variante C01-fuera-limite** (editar C01):

```prompt
Show error when the pin is placed outside the city limits: below the map card, an inline danger banner in soft red with an alert-triangle icon: "Ubicación fuera de Aguilares. Por favor, marcá el local dentro del radio urbano de la ciudad." The "Empezar" button is disabled.
```

**Variante C01-mapa-caido** (editar C01):

```prompt
Show graceful degradation when the map API fails to load: the map container is replaced by a soft muted card with an info icon: "No pudimos cargar el mapa. No te preocupes: continuá con la dirección y agregá una referencia." A textarea "Referencia adicional" is shown below the address input. The rest of the form and the primary button remain fully functional.
```

## C02 — Inicio con solicitudes activas

```prompt
Screen: merchant home.
Top bar in ink #12182C: horizontal white-and-teal cadeApp logo on the left, a small pill badge "Piloto" on the right.
Greeting "Hola, Panadería La Espiga".
Large primary full-width button with a plus icon "Nueva solicitud".
Section title "Activas" with a count "3".
Three request cards, each with a status badge, the route, details and a right chevron:
1. badge "Con ofertas" (teal outline) and a small live dot, route "Centro → Barrio Norte", details "Paquete chico · 3 ofertas", right text "Vence en 17 min".
2. badge "Asignada" (ink), route "Centro → Barrio Sur", details "Joaquín R. · $ 1.800", right text "Esperando retiro".
3. badge "En camino" (warning), route "Centro → Barrio Oeste", details "Micaela T. · $ 2.200", right text "Retirado 14:32".
Bottom navigation bar with icons and labels: "Inicio" (active, teal), "Historial", "Cuenta".
```

**Variante C02-vacío** (editar C02):

```prompt
Show the empty state instead of the list: a simple line illustration of the teal box with the wavy road line, title "Todavía no publicaste entregas", text "Publicá una y los repartidores de Aguilares te van a ofertar.", primary button "Nueva solicitud". Keep the top bar and the bottom navigation.
```

**Variante C02-bloqueado** (editar C02):

```prompt
Show the state when the merchant cannot publish: above the list, a warning card with a clock icon "Tu plan venció el 30/10. Para seguir publicando, hablá con cadeApp." and an outline button "Ver mi plan". The "Nueva solicitud" button is disabled. Existing requests are still visible.
```

## C03 — Nueva solicitud

```prompt
Screen: create a delivery request, top bar with a close icon and title "Nueva solicitud". One long scrollable form grouped in cards, with a sticky bottom button.
Card "Retiro": select "Barrio" (value "Centro"), input "Dirección" (value "San Martín 450", prefilled), and an outline button with a map-pin icon "Modificar punto en el mapa" showing a small badge "Punto del local fijado".
Card "Entrega": select "Barrio" (placeholder "Elegí un barrio"), input "Dirección" (placeholder "Calle y número, piso o referencia"), and an embedded interactive map card of Aguilares with a crosshair and drop pin, helper text "Mové el mapa para indicar el punto exacto de entrega.", plus an estimated distance chip below it "Distancia calculada: ≈ 2,0 km".
Card "Destinatario" with a lock icon and helper text "Solo lo ve el repartidor que elijas.": input "Nombre", input "Teléfono", checkbox "Mi cliente sabe que compartimos estos datos con el repartidor".
Card "Paquete": four selectable chips "Sobre", "Chico", "Mediano", "Grande" ("Chico" selected), textarea "Indicaciones" (placeholder "Ej.: frágil, tocar timbre 2B").
Card "¿Cómo paga el envío tu cliente?": segmented control "Efectivo | Transferencia | A coordinar" with "Efectivo" selected, and below a switch "Necesita cambio" turned on.
A teal-tinted info card with a wallet icon: "El envío lo paga quien recibe. Cuando aceptes una oferta, te armamos el mensaje para avisarle a tu cliente cuánto sale."
Sticky bottom button on white: primary "Publicar solicitud", with a muted line above it "Vence en 30 min si nadie la acepta".
```

**Variante C03-errores** (editar C03):

```prompt
Show validation errors after pressing "Publicar solicitud" with empty fields or pin out of bounds: the "Entrega" card fields show red borders with inline messages "Elegí el barrio de entrega", "Ingresá la dirección de entrega" and below the map card an inline error: "El punto de entrega debe estar dentro de Aguilares." The page is scrolled to that card. No toast.
```

**Variante C03-mapa-caido** (editar C03):

```prompt
Show graceful degradation when the map API fails to load in create request: the map card displays a muted fallback banner "No pudimos cargar el mapa de entrega. La solicitud se publicará con la dirección escrita y la distancia se estimará según los barrios." The rest of the form operates normally.
```

## C04 — Detalle con ofertas en vivo

```prompt
Screen: a published request with live offers.
Top bar with back arrow, title "Solicitud", and a text button "Cancelar" in red on the right.
Summary card: badge "Publicada", route "Centro → Barrio Norte", details "≈ 2 km · Paquete chico · Paga en efectivo (necesita cambio)", and a countdown chip with a clock icon "Vence en 17:42".
Row: title "Ofertas (3)" with a small pulsing teal dot and the text "En vivo"; on the right a segmented control "Documentación | Precio" with "Documentación" selected.
Three offer cards, each with: round avatar photo placeholder, name, vehicle line, badges, a big amount on the right in Montserrat, an ETA line, an optional message, and a full-width secondary button "Aceptar".
1. "Joaquín R.", "Moto · declarado", badges "Licencia verificada" and "Seguro verificado" (success), amount "$ 1.800", "Llega a retirar en ~10 min", message "Estoy a dos cuadras."
2. "Micaela T.", "Bici · declarado", badge "Licencia verificada", amount "$ 1.500", "Llega a retirar en ~15 min".
3. "Diego S.", "Moto · declarado", no badges, amount "$ 1.300", "Llega a retirar en ~20 min". This card has a soft teal highlight and a small "Nueva" label because it just arrived.
Muted note at the bottom: "Ordenamos primero a quienes tienen más documentación verificada. Vos elegís."
No map, no ratings or stars.
```

**Variante C04-sin-ofertas** (editar C04):

```prompt
Show the state with no offers yet: instead of the offer cards, a card with a subtle pulsing teal dot and the text "Esperando ofertas… Te avisamos cuando llegue la primera." and below it two skeleton offer cards with grey blocks in the same shape as the real offer cards.
```

**Variante C04-vencida** (editar C04):

```prompt
Show the expired state: the badge says "Vencida" (muted), the countdown is replaced by "Venció a las 15:10", the offer cards are hidden, and there is a card "Nadie aceptó a tiempo" with a primary button "Publicar de nuevo" and a ghost button "Volver al inicio".
```

## C05 — Confirmar aceptación

```prompt
Screen: the request detail from before, dimmed, with a centered confirmation dialog on top.
Dialog title "¿Aceptás la oferta de Joaquín R.?"
Summary inside the dialog: amount "$ 1.800" in Montserrat, "Moto · Licencia y seguro verificados", "Llega a retirar en ~10 min".
Text: "Al aceptar, Joaquín va a ver la dirección de retiro, la de entrega y los datos de tu cliente. Las otras ofertas se rechazan."
Buttons stacked full width: primary "Sí, aceptar" and outline "Volver".
```

**Variante C05-ya-asignada** (editar C05):

```prompt
Replace the dialog content with an error state: warning icon, title "Esta solicitud ya tiene repartidor", text "Otra acción la asignó hace un momento. Actualizamos la pantalla.", single primary button "Entendido".
```

## C06 — Viaje (vista del comercio)

```prompt
Screen: active delivery for the merchant after accepting an offer.
Top bar with back arrow and title "Envío en curso".
Horizontal 3-step progress: "Asignada" (done), "Retirado" (current, teal), "Entregado" (pending).
Courier card: avatar, "Joaquín R.", "Moto · AB 123 CD", badges "Licencia verificada" and "Seguro verificado", agreed price "$ 1.800". Two buttons side by side: a WhatsApp green-outline button "WhatsApp" and an outline button with a phone icon "Llamar".
Highlight card "Mapa del viaje": an interactive map showing both points in Aguilares: fixed store pickup with a teal pin and customer dropoff with an ink pin, connected by a clean route line, with a distance chip "≈ 2,0 km".
Highlighted primary card: title "Avisale a tu cliente cuánto sale el envío", a message preview in a light bubble: "Hola Laura, tu pedido de Panadería La Espiga sale en camino con Joaquín (moto). El envío cuesta $ 1.800 y se paga en efectivo al recibir." and a full-width primary button with the WhatsApp icon "Avisar a mi cliente".
Card "Datos de la entrega": "Retiro: San Martín 450, Centro", "Entrega: Belgrano 1220, Barrio Norte", "Destinatario: Laura M. · 381 555-0456", "Paga: efectivo, necesita cambio", "Indicaciones: tocar timbre 2B".
Bottom section with three ghost actions separated by dividers: "El repartidor no llegó", "Reportar un problema", and in red "Cancelar envío".
No live GPS tracking of courier.
```

**Variante C06-no-llegó** (editar C06):

```prompt
Show a bottom sheet over the screen titled "¿El repartidor no llegó?" with text "Cancelamos esta asignación y volvemos a publicar tu solicitud para recibir nuevas ofertas.", a textarea "Contanos qué pasó (opcional)", a primary button "Volver a publicar" and a ghost button "Esperar un poco más".
```

## C07 — Historial

```prompt
Screen: merchant history.
Title "Historial". Tabs: "Todas", "Entregadas", "Canceladas", "Vencidas" ("Todas" selected).
A search-free list grouped by date headers ("Hoy", "Ayer", "12 de octubre"). Each row: route "Centro → Barrio Sur", a muted line "Joaquín R. · $ 1.800 · 14:50", and a status badge on the right ("Entregada" success, "Cancelada" danger, "Vencida" muted).
At the end of the list, an outline button "Ver más".
Bottom navigation with "Historial" active.
```

## C08 — Mi plan

```prompt
Screen: merchant plan status, title "Mi plan".
Main card: badge "Piloto" in teal, title "Estás en el piloto gratis", text "Podés publicar todas las entregas que quieras mientras dure el piloto."
Second card titled "Después del piloto": text "Para seguir usando cadeApp vas a pagar un abono mensual directamente a cadeApp. Te vamos a avisar antes de que termine." and an outline button with the WhatsApp icon "Hablar con cadeApp".
Muted note: "El costo de cada envío no pasa por cadeApp: lo paga quien recibe."
Link "Términos del piloto". Bottom navigation with "Cuenta" active.
```

**Variante C08-activo** (editar C08):

```prompt
Change the main card to the paid state: badge "Activo" in success green, title "Tu plan está al día", text "Pagado hasta el 30/11". Keep the rest.
```
