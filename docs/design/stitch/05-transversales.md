# 05 — Pantallas transversales

Tipo de dispositivo: **Mobile**. Cada prompt va precedido por el Bloque de estilo de `00-sistema-de-diseno.md`.

## T01 — Instalar la app en iPhone

```prompt
Screen: install guide for iPhone, shown to merchants and couriers who open cadeApp in Safari.
Title "Instalá cadeApp en tu iPhone", text "Así te llegan los avisos de ofertas y solicitudes."
Three numbered steps, each in a card with a simple icon illustration:
1. "Tocá el botón Compartir" with the iOS share icon (square with an up arrow) and the hint "Está abajo, en el medio de Safari."
2. "Elegí «Agregar a inicio»" with a plus-in-square icon.
3. "Abrí cadeApp desde el ícono" with a small app icon: teal rounded square with the white box and scooter.
A muted note: "Si usás Chrome en iPhone, primero abrí este link en Safari."
Primary button "Ya la instalé" and ghost button "Más tarde".
```

## T02 — Pedido de permiso de notificaciones

```prompt
Screen: a friendly pre-permission screen before the browser asks for notifications.
Centered: a bell icon inside a teal circle, title "¿Te avisamos al instante?", text for couriers "Te avisamos cuando aparezca una solicitud nueva o cuando te elijan."
A muted note: "Si no llegan, igual lo vas a ver en la app al abrirla."
Primary button "Activar avisos", ghost button "Ahora no".
```

## T03 — Sin conexión

```prompt
Screen: offline state inside the app, keeping the top bar and the bottom navigation.
A thin warning bar under the top bar: wifi-off icon and "Sin conexión. Mostramos lo último que cargó."
Below, the courier request list faded to 60% opacity, with the "Ofertar" buttons disabled.
A floating card at the bottom: "Cuando vuelva la conexión, actualizamos solo." with an outline button "Reintentar".
```

**Variante T03-mapa-sin-conexion** (editar componente de mapa en T03):

```prompt
Show the map offline state inside any screen with a map: the map container is replaced by a light slate card with a wifi-off icon, title "Mapa sin conexión", text "No podemos cargar el mapa de Google sin internet. Podés continuar escribiendo las referencias de la dirección o reintentar.", and an outline button "Reintentar cargar mapa".
```

## T04 — Error general y página no encontrada

```prompt
Screen: generic error page.
Centered: the teal wavy road line drawn as a broken path, title "Algo salió mal", text "No es tu culpa. Probá de nuevo en unos segundos.", primary button "Reintentar", ghost button "Ir al inicio", and a muted small line "Código: 5F2A" for support.
```

**Variante T04-404** (editar T04):

```prompt
Change it to a not-found page: title "No encontramos esta página", text "Puede que el link esté mal o que la solicitud ya no exista.", single primary button "Ir al inicio". Remove the error code.
```

**Variante T04-pin-fuera-de-aguilares** (editar T04):

```prompt
Show an inline map boundary alert card: warning icon in amber/gold, title "Ubicación fuera de Aguilares", text "El marcador está fuera del radio de cobertura del piloto de Aguilares. Por favor, arrastrá el pin dentro de los límites de la ciudad.", and an outline button "Centrar en el centro de Aguilares".
```

**Variante T04-mapa-caido** (editar T04):

```prompt
Show the map service error state: the map box displays a subtle warning card, title "Servicio de mapas no disponible", text "Ocurrió un problema al conectar con Google Maps. Podés completar el pedido ingresando las calles y referencias de forma manual.", with a secondary button "Continuar solo con texto".
```

## T05 — Confirmación de acción irreversible

```prompt
Screen: a merchant request detail, dimmed, with a confirmation dialog on top.
Danger icon, title "¿Cancelar esta solicitud?", text "Las ofertas que recibiste se van a cerrar. No se puede deshacer."
Required select "Motivo" (options: "Ya no hace falta", "Lo resolví de otra forma", "Me equivoqué en los datos", "Otro").
Buttons stacked full width: danger "Sí, cancelar solicitud" and outline "Volver".
```

## T06 — Aviso (toast) y estado de carga de un detalle

```prompt
Screen: the merchant request detail while loading, and a toast example.
Top bar with back arrow and title "Solicitud". The summary card and three offer cards are skeletons: grey rounded blocks with a subtle shimmer, in exactly the same size and position as the real content (badge, route line, two detail lines, amount block on the right, button block).
At the bottom, above the safe area, a toast with an ink background and white text: check icon, "Oferta aceptada", and a ghost action "Ver". The toast does not cover the main buttons.
```
