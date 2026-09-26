# Lecciones de la PR #109

## AG-111 · Una allowlist genérica no anula una precondición específica de la ficha
Si la regla de stack permite un paquete pero la tarea exige contract-change separado y previo, manda la condición específica.

## AG-112 · Un dynamic import no es frontera si el mismo módulo entra por import síncrono
No importar el skeleton desde el mismo módulo que contiene el SDK que se intenta lazy-load.

## AG-113 · “Proveedor caído” se prueba haciendo caer al proveedor
Ausencia de key y fallo del loader son estados distintos.

## AG-115 · La integración se prueba cruzando la frontera de datos
Pin/cámara -> lat/lng del form -> payload exacto de la action. Un onChange no-op debe matar el test.

## AG-116 · Teclado y cámara son caminos distintos
Un test de ArrowUp no verifica GoogleMap.onCameraChanged.

## AG-117 · Las variables públicas también tienen frontera
NEXT_PUBLIC_* debe consumirse por src/lib/env.public.ts cuando el repo ya centraliza allí validación.

## AG-118 · El copy de fallback debe corresponder a datos reales
Si la UI promete centroide de barrio, la query debe traerlo y el flujo debe usarlo.

## AG-119 · Un componente compartido no debe duplicar controles del formulario anfitrión
El mapa debe componerse sin crear una segunda dirección o una segunda acción de geolocalización salvo diseño explícito.
