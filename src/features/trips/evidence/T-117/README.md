# Evidencia visual T-117 — Mapa de recorrido y botón "Abrir en Google Maps"

Capturas obtenidas desde Microsoft Edge headless Chromium a las resoluciones móviles requeridas (360×800 y 390×844):

## 1. C06 — Vista de viaje para el comercio (`TripMerchantView`)
- `c06_merchant_360x800.png` (360×800)
- `c06_merchant_390x844.png` (390×844)
- Muestra los dos pines fijos de retiro y entrega unidos por la traza orientativa directa.
- Distancia calculada en servidor formateada como `≈ 2,5 km`.
- No inventa botón de navegación externa (reservado al repartidor).

## 2. R07 — Vista de viaje para el repartidor (`TripCourierView`)
- `r07_courier_360x800.png` (360×800)
- `r07_courier_390x844.png` (390×844)
- Muestra el mapa interactivo con los dos pines fijos y la traza orientativa.
- Botón "Abrir en Google Maps" con URL canónica `https://www.google.com/maps/dir/?api=1&origin=...&destination=...`.
- Target táctil accesible de 48 px de alto mínimo con borde redondeado y contraste accesible.
- Botón sticky inferior de avance de 56 px de alto.

## 3. Estado degradado sin mapa (`TripCourierView` degradado)
- `r07_courier_degraded_360x800.png` (360×800)
- `r07_courier_degraded_390x844.png` (390×844)
- Resiliencia ante mapa caído (`APILoadingStatus.FAILED` o `onError`), sin conexión (`navigator.onLine === false`) o sin API key configurada.
- Las direcciones exactas en texto siguen 100% visibles y el botón "Abrir en Google Maps" permanece 100% operativo sin depender del SDK de Google Maps.
