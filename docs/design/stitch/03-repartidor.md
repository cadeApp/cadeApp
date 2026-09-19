# 03 — Repartidor independiente

Tipo de dispositivo: **Mobile**. Cada prompt va precedido por el Bloque de estilo de `00-sistema-de-diseno.md`.

Navegación común del repartidor aprobado: barra inferior fija con tres ítems (**Solicitudes**, **Mis ofertas**, **Perfil**).

Reglas de estas pantallas:
- En la lista (R04) y al ofertar (R05) **no** aparecen la dirección exacta, el nombre ni el teléfono del destinatario, ni mapa ni coordenadas: solo barrios de origen y destino, distancia aproximada redondeada a 0,5 km, tipo de paquete y medio de pago. Todo se revela recién cuando aceptan su oferta (D3, D15).
- En el viaje activo (R07), el repartidor ve el mapa interactivo con los dos pines (retiro y entrega) y el botón de 48 px para abrir la navegación en Google Maps externa. No hay GPS en vivo ni seguimiento en tiempo real del repartidor (D7, D15).
- El piso de oferta se muestra, pero lo valida el servidor (§6.2).
- Todas las acciones principales miden 48 px o más: se usan en la calle, con una mano.

## R01 — Onboarding: documentos obligatorios

```prompt
Screen: courier onboarding, step 2 of 4 "Tu identidad". Progress bar at the top with labels "Datos", "Identidad", "Vehículo", "Listo".
Short text: "Lo revisa una persona de cadeApp. Tus documentos se guardan privados y solo los ve el equipo que aprueba."
Input "Número de DNI" (numeric keyboard).
Three upload tiles in a list, each with an icon, a title, a hint and a status on the right:
- "DNI frente" with a thumbnail of an uploaded photo and a success check "Cargado", plus a small ghost action "Cambiar".
- "DNI dorso" empty, dashed teal border, camera icon, text "Sacá una foto", hint "Con buena luz y sin reflejos".
- "Selfie" empty, dashed border, face icon, text "Sacate una selfie", hint "Sin anteojos de sol ni gorra".
Then "Foto de perfil" tile, hint "La van a ver los comercios".
Sticky bottom: primary button "Continuar" (disabled while tiles are missing) and a muted line "Paso 2 de 4".
```

## R02 — Onboarding: vehículo, opcionales y consentimientos

```prompt
Screen: courier onboarding, step 3 of 4 "Tu vehículo".
Four selectable cards in a 2×2 grid with icons: "A pie", "Bici", "Moto" (selected), "Auto". Input "Patente" (value "AB 123 CD") shown because "Moto" is selected.
Card with the teal wavy-line accent titled "Aparecé primero": text "Si subís tu licencia y tu seguro y los verificamos, los comercios ven tus ofertas primero y con insignia." Two optional upload tiles: "Licencia de conducir (opcional)" and "Seguro (opcional)", each with an outline button "Subir".
Section "Consentimientos" with three checkboxes and links: "Acepto los Términos para repartidores", "Acepto la Política de privacidad y el uso de mis documentos para verificarme", "Entiendo que soy independiente: cadeApp no me emplea ni cobra por mí".
Sticky bottom primary button "Enviar para revisión".
```

## R03 — En revisión

```prompt
Screen: courier waiting for approval.
Centered content: a line illustration of the teal box with the wavy road line and a small clock, title "Estamos revisando tus datos", text "Te avisamos por acá y por notificación cuando estés aprobado."
A checklist card: "DNI frente" (check), "DNI dorso" (check), "Selfie" (check), "Foto de perfil" (check), "Licencia" (muted "No cargada"), "Seguro" (muted "No cargado").
Outline button "Completar documentación opcional". Ghost button "Salir".
```

**Variante R03-rechazado** (editar R03):

```prompt
Show the rejected state: danger icon, title "No pudimos aprobarte", a card with the reason "La foto del DNI no se lee bien." and the text "Podés volver a cargarla." with a primary button "Cargar de nuevo" and a ghost link "Escribir a cadeApp".
```

## R04 — Solicitudes abiertas

```prompt
Screen: courier home with the list of open requests in the city.
Top bar in ink #12182C with the horizontal cadeApp logo.
Big availability card at the top: a large switch "Disponible" turned on (teal), text "Ves las solicitudes y te llegan avisos."
Title "Solicitudes abiertas" with a small teal live dot "En vivo" and a count "4".
Request cards, each with: route in bold "Centro → Barrio Norte", a detail line with icons "≈ 2,5 km · Paquete chico", a payment line with a wallet icon "Paga en efectivo · necesita cambio", a muted line "Publicada hace 3 min · vence en 27 min", and a full-width secondary button "Ofertar" (48 px).
Second card: "Barrio Sur → Centro", "≈ 1,0 km · Sobre", "Paga con transferencia". Third card: "Centro → Barrio Oeste", "≈ 3,0 km · Mediano", "Paga: a coordinar", with a small badge "Ya ofertaste $ 1.600" instead of the "Ofertar" button.
No addresses, no customer names, no map.
Bottom navigation: "Solicitudes" (active), "Mis ofertas", "Perfil".
```

**Variante R04-no-disponible** (editar R04):

```prompt
Show the unavailable state: the switch is off and says "No disponible", the list is replaced by a card "Activá Disponible para ver las solicitudes y recibir avisos." with the switch repeated in large size. Keep the bottom navigation.
```

**Variante R04-carga** (editar R04):

```prompt
Show the loading state: keep the top bar and the availability card, and replace the request cards with three skeleton cards made of grey blocks in exactly the same shape (route line, two detail lines and a button-sized block).
```

## R05 — Ofertar

```prompt
Screen: the open requests list, dimmed, with a bottom sheet on top titled "Tu oferta".
Sheet summary: "Centro → Barrio Norte", "≈ 2,5 km · Paquete chico · Paga en efectivo (necesita cambio)", indications "Frágil".
Large amount input in Montserrat with a "$" prefix and value "1.500", numeric keyboard hint, helper text "Mínimo $ 1.000". Quick chips below: "$ 1.200", "$ 1.500", "$ 2.000".
Select "¿En cuánto llegás a retirar?" with value "15 min".
Optional textarea "Mensaje para el comercio" (placeholder "Ej.: estoy cerca").
Muted note: "Si te eligen, vas a ver las direcciones exactas, el mapa del recorrido y el contacto del cliente. El envío se lo cobrás a quien recibe."
Primary full-width button "Enviar oferta" (48 px) and ghost "Cancelar".
```

**Variante R05-bajo-el-mínimo** (editar R05):

```prompt
Show the error state: the amount is "800", the input has a red border and the inline message "La oferta mínima es $ 1.000." The "Enviar oferta" button stays enabled. No toast.
```

## R06 — Mis ofertas

```prompt
Screen: courier offers, title "Mis ofertas". Tabs "Pendientes (2)", "Aceptadas (1)", "Otras".
In "Pendientes", offer cards: route "Centro → Barrio Oeste", "Ofertaste $ 1.600 · hace 5 min", status badge "Pendiente" (teal outline), muted line "La solicitud vence en 22 min", and an outline button "Retirar oferta".
Second card: route "Barrio Sur → Centro", "Ofertaste $ 1.200 · hace 12 min", badge "Pendiente".
Show below, as a separate highlighted card at the top of the list, an accepted offer: badge "¡Te eligieron!" (success), route "Centro → Barrio Norte", "$ 1.800", primary button "Ir al viaje".
Bottom navigation with "Mis ofertas" active.
```

## R07 — Viaje (vista del repartidor)

```prompt
Screen: active delivery for the courier after offer acceptance.
Top bar with back arrow and title "Tu viaje".
Horizontal 3-step progress: "Asignada" (current), "Retirado", "Entregado".
Big money card: "Cobrás al entregar" and "$ 1.800" in Montserrat 36 px, with a line "Efectivo · necesita cambio".
Highlight card "Recorrido en mapa": an interactive map of Aguilares showing the exact store pickup pin (teal) and customer dropoff pin (ink), connected by a clear route overview line, with a distance chip "≈ 2,5 km".
Below the map: a prominent full-width outline button 48 px tall with an external map icon "Abrir en Google Maps".
Card "Retiro" with a store icon: "Panadería La Espiga", "San Martín 450, Centro", and two buttons side by side "WhatsApp" (green outline) and "Llamar".
Card "Entrega" with a pin icon: "Laura M.", "Belgrano 1220, Barrio Norte", indications "Tocar timbre 2B · Frágil", and two buttons "WhatsApp" and "Llamar".
Sticky bottom: a very prominent primary full-width button 56 px tall "Marcar como retirado".
Below the cards: ghost actions "Reportar un problema" and, in red, "No puedo hacer este viaje".
No live GPS tracking of courier position.
```

**Variante R07-mapa-caido** (editar R07):

```prompt
Show the map fallback state: the map container is replaced by a subtle grey card with an alert icon, text "No se pudo cargar el mapa interactivo", the exact addresses clearly readable in text, and the 48 px button "Abrir en Google Maps" fully functional.
```

**Variante R07-en-camino** (editar R07):

```prompt
Change the progress to "Retirado" done and "Entregado" current, and the sticky button to a success-green 56 px button "Marcar como entregado". Before confirming, show a small dialog "¿Entregaste y cobraste $ 1.800?" with buttons "Sí, entregado" and "Volver".
```

## R08 — Perfil y documentación

```prompt
Screen: courier profile, title "Perfil".
Header: large round avatar, name "Joaquín R.", badge "Aprobado" (success), vehicle line "Moto · AB 123 CD".
Card "Tu documentación" with a progress text "1 de 2 opcionales verificados" and the badge "Licencia verificada".
List of documents with status on the right: "DNI" → "Verificado", "Selfie" → "Verificada", "Licencia" → "Verificada", "Seguro" → "En revisión" in warning color, and a row "Cambiar foto de perfil" with an outline button "Cambiar".
Card: "Más documentación verificada = tus ofertas aparecen primero."
Settings rows: "Notificaciones" with a switch, "Instalar la app", "Términos y privacidad", "Cerrar sesión".
Bottom navigation with "Perfil" active.
```
