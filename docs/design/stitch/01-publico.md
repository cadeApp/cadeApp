# 01 — Público (sin sesión)

Tipo de dispositivo: **Mobile**. Cada prompt va precedido por el Bloque de estilo de `00-sistema-de-diseno.md`.

## P01 — Inicio

```prompt
Screen: public home page of cadeApp.
Top bar: horizontal cadeApp logo on the left, text button "Ingresar" on the right.
Hero: a small pill badge "Piloto gratis en Aguilares", headline "Tu envío, al precio que elijas", subtitle "Publicá lo que necesitás mandar y los repartidores de Aguilares te ofertan en vivo. Vos elegís con quién." Two full-width stacked buttons: primary "Tengo un comercio", outline "Quiero repartir".
Section "Cómo funciona": three numbered cards in a vertical list: 1 "Publicás la entrega" with "Barrio de retiro, barrio de entrega y tipo de paquete."; 2 "Recibís ofertas" with "Los repartidores te dicen cuánto cobran."; 3 "Elegís y coordinás" with "Hablás por WhatsApp con el repartidor elegido."
Info card with a wallet icon: title "¿Quién paga el envío?", text "Lo paga quien recibe, al momento de la entrega. cadeApp no cobra ni maneja ese dinero."
Card for couriers: title "¿Tenés moto, bici o auto?", text "Sumate como repartidor independiente. Cargás tu DNI y una selfie, y te aprobamos.", outline button "Quiero repartir".
Footer: small links "Términos · Privacidad · Términos del piloto" and "Hecho en Aguilares, Tucumán".
No photos, no map, no app store badges, no prices.
```

## P02 — Ingresar

```prompt
Screen: sign in.
Top: back arrow and centered small cadeApp logo.
Title "Ingresá a tu cuenta".
Form: input "Email" (keyboard email), input "Contraseña" with a show/hide eye icon, text link aligned right "¿Olvidaste tu contraseña?". Primary full-width button "Ingresar".
Divider with the word "o".
Outline full-width button with a mail icon "Recibir un código por email".
Bottom text: "¿No tenés cuenta?" with link "Registrate".
```

**Variante P02-error** (editar P02):

```prompt
Show the error state: below the password field an inline red message with an alert icon "Email o contraseña incorrectos." The fields keep their values. No toast.
```

## P03 — Registrarse

```prompt
Screen: create an account, step 1 of 2 "¿Cómo vas a usar cadeApp?".
Two large selectable cards, full width, each with an icon, a title and one line of text:
- store icon, "Tengo un comercio o emprendimiento", "Publicá entregas y elegí al repartidor." (this card is selected: teal border 2 px and a check in the corner)
- scooter icon, "Quiero repartir", "Ofertá en las entregas de tu ciudad."
Below: input "Email", input "Contraseña" with helper text "Mínimo 8 caracteres", checkbox "Acepto los Términos y la Política de privacidad" where both are links.
Primary full-width button "Crear cuenta".
Bottom text: "¿Ya tenés cuenta?" with link "Ingresá".
```

## P04 — Documento legal

Sirve para términos, privacidad y términos del piloto. Cambian el título y el texto.

```prompt
Screen: a legal document reader, example "Términos del piloto".
Top bar with back arrow and title "Términos del piloto".
Below the title a muted line "Versión 1 · Aguilares, Tucumán".
A collapsible index card "Contenido" with 5 items: "Qué es el piloto", "Duración", "Qué hace y qué no hace cadeApp", "Pago del envío", "Datos personales".
Readable long text: 16 px, line height 1.6, section headings, short paragraphs. Include this highlighted callout card: "cadeApp conecta comercios con repartidores independientes. No es una empresa de envíos, no emplea repartidores y no cobra el envío: lo paga quien recibe."
Sticky bottom bar on white with a top border: checkbox "Leí y acepto" and a primary button "Continuar" (disabled until checked).
```
