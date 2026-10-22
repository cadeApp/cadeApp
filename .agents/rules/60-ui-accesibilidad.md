# UI, diseño y accesibilidad

## Componentes y estilos
- Librería base: shadcn/ui copiada en `src/ui` (primitivas Radix) + Tailwind. `components.json` apunta a `src/ui`.
- Tokens de diseño como variables CSS en `src/ui/tokens.css`, mapeados al tema de Tailwind (colores semánticos:
  `primary`, `surface`, `muted`, `success`, `warning`, `danger`; tipografía; radios; espaciado). Hasta que haya diseño
  final, los tokens son provisorios.
- Prohibido: valores arbitrarios de color o tamaño en clases (`bg-[#12ab34]`, `text-[13px]`), estilos inline, CSS
  suelto por feature. Si falta un token o un componente, contract-change liviano a `src/ui`.
- Variantes con `class-variance-authority`; composición de clases con la utilidad `cn` de `src/ui/cn.ts`.
- Si falta una primitiva, se pide a P2 (dueña de `src/ui`); no se crea una copia local.

## Estados de carga: Skeleton
- Toda espera visible usa `Skeleton` de `src/ui`, nunca un spinner de página completa ni una pantalla en blanco.
- Cada ruta con datos tiene `loading.tsx` o un `Suspense` con un skeleton que **imita la forma final** (misma
  altura de tarjetas y cantidad aproximada de filas), así la pantalla no salta cuando llegan los datos.
- Los skeletons de cada pantalla viven en su feature (`components/<pantalla>-skeleton.tsx`) y se construyen solo con `Skeleton`.
- Botones que envían: estado deshabilitado + indicador dentro del botón mientras la acción está pendiente (`useFormStatus`/`isPending`).

## Avisos: Sonner
- Un solo `<Toaster />` (el de shadcn/ui) montado en `providers.tsx`; posición y duración definidas una vez.
- Las features nunca importan `sonner` directo: usan `notify.success`, `notify.error`, `notify.info` y
  `notify.promise` de `src/ui/notify.ts`. Los mensajes salen de `copy.ts` o de `src/lib/error-messages.ts`.
- Un toast confirma o avisa; **nunca es la única señal** de algo importante. Ejemplo: una oferta aceptada o una
  solicitud expirada se ven también en la pantalla (estado, badge), porque el toast desaparece.
- Errores de acciones: `notify.error` con el mensaje del `DomainErrorCode`. Errores de validación de formulario van
  al lado del campo, no en toast.
- Sin toasts en cascada: agrupar o reemplazar por id. Nada de datos personales en un toast.

## Animaciones: Motion
- Solo con `motion` y los presets de `src/ui/motion/` (duraciones, easings y variantes: aparecer, salir, deslizar
  hoja inferior, resaltar un ítem nuevo). No se inventan curvas ni duraciones por feature.
- `LazyMotion` con el conjunto de features reducido y componentes livianos, para cuidar el presupuesto de bundle
  (regla 25). Se configura una vez en `providers.tsx`.
- `MotionConfig` con `reducedMotion="user"`: si la persona pide menos movimiento, no hay animaciones de desplazamiento.
- Animar solo `transform` y `opacity`. Nada de animar `width`, `height`, `top` o `left`, ni layout animations en listas largas.
- Cortas: 150–250 ms para feedback y hasta 300 ms para entradas y salidas. Nunca bloquean la interacción ni retrasan
  información (una oferta nueva aparece al instante y después se resalta).
- Los componentes animados son cliente: se aíslan en hojas `"use client"` y no convierten la página entera en cliente.
- Playwright corre con `reducedMotion: 'reduce'` para evitar pruebas inestables.

## Diseño (Stitch u otra herramienta)
- Un diseño exportado es **referencia**, no código para pegar. Se implementa con la skill `implementar-diseno`:
  primero tokens, después componentes de `src/ui`, después pantallas.
- Toda pantalla tiene estados de carga, vacío, error y sin conexión aunque el diseño no los dibuje.

## Accesibilidad y uso en la calle
- WCAG 2.2 AA: contraste ≥ 4.5:1, foco visible, labels asociados, roles/aria correctos, orden de tabulación lógico.
- Objetivos táctiles ≥ 48×48 px en acciones del repartidor (Ofertar, Aceptar, Contactar, Retirado, Entregado).
- Mobile-first: se diseña a 360 px de ancho y se agranda.
- Montos: `inputmode="numeric"`, piso vigente visible, formato ARS sin decimales (`formatArs`).
- Acciones irreversibles (aceptar, cancelar, suspender): confirmación en dos pasos con el Dialog de `src/ui`.
- Siempre estados de carga, vacío y error; nunca pantallas en blanco.
- Textos en es-AR desde `copy.ts`, directos. No mostrar "verificado" si el admin no revisó el comprobante.
- Server Components por defecto; `"use client"` solo donde hay interacción.
