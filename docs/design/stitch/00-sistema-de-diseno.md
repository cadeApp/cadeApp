# 00 — Sistema de diseño

## Bloque de estilo

Va **delante de cada prompt** de todos los archivos, copiado literal.

```text
cadeApp design system. Mobile-first PWA designed at 390 px wide, light theme only.
Brand colors: teal #09BABD for brand fills, highlights and the primary button background (primary button text in ink #12182C); ink navy #12182C for text, the top bar and secondary buttons; deep teal #0B7A7D for links and any teal text on light backgrounds (never use #09BABD for text on white); background #FDFCFB; surface #FFFFFF; border #E4E7EC; muted text #5B6475; success #177A4B; warning #B45309 on #FFF4E0; danger #C62828.
Typography: Montserrat 700 for headings and money amounts (it matches the logo wordmark); Inter 400/500/600 for everything else; body 16 px, never smaller than 14 px.
Shape: 12 px radius on cards, 10 px on buttons and inputs, pill-shaped badges; flat surfaces with a soft shadow only on sheets and dialogs; 8 px spacing grid; 16 px side padding.
Touch: every primary action is at least 48 px tall and full width on mobile.
Icons: lucide-style outline icons, 2 px stroke.
Brand motif: the logo shows a teal delivery box crossed by a rounded wavy road line, carried by a rider on a scooter. That wavy line may appear as a thin teal accent in empty states and section headers; keep it subtle.
Components look like shadcn/ui: Button, Card, Badge, Input, Select, Tabs, Dialog, Sheet, Toast, Skeleton.
Copy in Argentine Spanish with voseo ("Publicá", "Ofertá"), short and direct. Money in whole Argentine pesos, dot as thousands separator, no decimals: "$ 1.500".
Mood: clean, friendly and trustworthy app for small local shops and independent couriers of a small city. Flat and high contrast (WCAG AA). No gradients, no stock photos, no 3D, no glassmorphism. Maps are used only for location pin selection and post-acceptance route preview (flat, minimal style, Aguilares boundary); no live GPS tracking, no rider moving markers.
```

## S00 — Hoja de marca

Adjuntar `assets/4.png` si la herramienta lo permite.

```prompt
Screen: a one-page brand and component sheet for cadeApp, used as the reference for all other screens.
Top: the cadeApp logo (teal delivery box crossed by a wavy road line, ink-navy rider on a scooter, wordmark "CadeApp" below).
Section "Colores": swatches with names and hex codes: Teal #09BABD, Tinta #12182C, Teal oscuro #0B7A7D, Fondo #FDFCFB, Superficie #FFFFFF, Borde #E4E7EC, Texto secundario #5B6475, Éxito #177A4B, Aviso #B45309, Error #C62828.
Section "Tipografía": "Título grande" in Montserrat 700 28 px, "Título de sección" 20 px, body text in Inter 16 px, small text 14 px, and a money amount "$ 1.500" in Montserrat 700 32 px.
Section "Botones": primary teal with ink text "Publicar solicitud", secondary ink with white text "Ofertar", outline "Cancelar", ghost "Ver detalle", destructive red "Cancelar solicitud", and a primary button in loading state with a small spinner inside and the text "Enviando…". All 48 px tall.
Section "Campos": text input with label "Teléfono" and helper text, the same input in error state with the message "Ingresá un teléfono válido" below it, a select "Barrio de entrega", a segmented control "Efectivo | Transferencia | A coordinar", a checkbox and a switch labeled "Disponible".
Section "Insignias": "Publicada" (teal), "Con ofertas" (teal outline), "Asignada" (ink), "En camino" (warning), "Entregada" (success), "Vencida" (muted), "Cancelada" (danger), "Licencia verificada" (success with check icon), "Moto · declarado" (muted outline).
Section "Tarjeta": an example request card: "Centro → Barrio Norte", "≈ 2 km · Paquete chico", "Paga en efectivo (necesita cambio)", badge "Publicada", text "Vence en 18 min".
Section "Carga": the same card as a skeleton with grey shimmer blocks in the same shape.
Section "Aviso": a toast at the bottom "Oferta enviada" with a check icon.
```
