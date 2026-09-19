# cadeApp — plan original (candidato a revisión)

Fuente: idea de producto enviada por Lautaro el 2026-09-17. Este plan transcribe la idea y las respuestas del intake. No agrega soluciones: las preguntas abiertas quedan para el Consejo.

## 1. Propuesta

Una plataforma web SaaS (PWA) que conecta a quien necesita hacer una entrega (comercio, emprendedor o particular) con repartidores independientes de la zona. No es una empresa de delivery y no cobra ni administra el dinero del envío. Solo es el punto de encuentro: se publica la solicitud, los repartidores ofertan y el solicitante elige.

Resumen: alguien necesita una entrega → publica la solicitud → los repartidores cercanos ofertan → el creador elige → las partes coordinan directamente.

## 2. Decisiones humanas del intake (Lautaro, 2026-09-17)

- Ingresos: suscripción mensual para comercios y emprendedores. Los repartidores usan la app gratis. La plataforma sigue sin tocar el dinero del envío.
- Zona de lanzamiento: solo Aguilares, provincia de Tucumán, Argentina.
- Repartidor habilitado: carga DNI, selfie y datos del vehículo, y un administrador lo aprueba a mano antes de que pueda ofertar.

## 3. Actores

- Solicitante: comercio, emprendimiento o particular que publica solicitudes.
- Repartidor independiente: se registra, un admin lo aprueba, ve solicitudes y oferta.
- Administrador de cadeApp: aprueba repartidores y gestiona la plataforma.
- Destinatario: recibe el pedido. No es usuario; solo figuran su nombre y teléfono.

## 4. Datos de una solicitud

- Nombre del comercio, emprendimiento o persona que solicita.
- Dirección de retiro.
- Dirección de entrega.
- Nombre y teléfono de quien recibe.
- Tipo de producto o paquete.
- Indicaciones adicionales para el repartidor.

## 5. Flujo principal

1. Creación: el solicitante carga retiro, destino y características del envío.
2. Publicación: la solicitud queda visible para los repartidores habilitados, primero los disponibles y más cercanos al punto de retiro.
3. Ofertas: cada repartidor interesado dice cuánto cobraría. Ninguna oferta puede ser menor a ARS 1.000.
4. Selección: el solicitante compara las ofertas y elige la que prefiera.
5. Confirmación: al aceptar, ambas partes reciben los datos para coordinar retiro y entrega.
6. Entrega: el repartidor hace el viaje y el pago se arregla entre las partes (efectivo, transferencia, Mercado Pago u otro medio).

Ejemplo: un emprendimiento de comida publica un envío y recibe ofertas de ARS 1.500, 1.800 y 2.000. Acepta la de 1.500, le avisa el costo a su cliente y acuerda con él cómo paga.

## 6. Reglas de ofertas

- Oferta mínima de referencia: ARS 1.000.
- Por encima del mínimo el precio es libre. El repartidor considera distancia, tipo de paquete, tiempo estimado, ubicación y condiciones de la entrega.
- El solicitante ve todas las ofertas y acepta la que quiera. No hay precio automático.

## 7. Restricciones técnicas (definidas por el usuario)

- Nombre: cadeApp.
- Frontend en Next.js con TypeScript en modo strict.
- Backend dentro del mismo proyecto Next.js, sin servicio aparte.
- Debe funcionar como PWA.
- Base de datos, autenticación y tiempo real: Supabase o Firebase. El Consejo tiene que recomendar uno y justificarlo para este proyecto.
- El diseño visual se define después del plan y queda fuera de esta revisión.

## 8. Preguntas abiertas para el Consejo

1. Supabase o Firebase: modelo de datos relacional frente a documental, consultas geográficas, tiempo real para ofertas, autenticación, reglas de acceso, almacenamiento de DNI y selfies, costos en plan gratuito y pago, y dependencia del proveedor.
2. Cómo definir "repartidor disponible y cercano": ubicación en vivo, ubicación al marcarse disponible o zona declarada. Precisión y privacidad.
3. Notificaciones de nuevas solicitudes y ofertas en una PWA (Android, iOS), y qué pasa si no llegan.
4. Estados y excepciones: expiración de solicitudes sin ofertas, retiro o cambio de ofertas, cancelación por cualquiera de las partes, repartidor que no se presenta, confirmación de entrega y calificaciones.
5. Suscripción: qué pasa con los particulares que publican de vez en cuando, cómo se cobra el abono, si hay período de prueba o límite gratuito, y la facturación del abono.
6. Privacidad: cuándo ve el repartidor el teléfono y la dirección del destinatario, y cómo se guardan y protegen el DNI y la selfie.
7. Responsabilidad legal: la plataforma como intermediaria frente a pérdida, daño o robo del paquete, siniestros viales y relación laboral con los repartidores. Términos y condiciones.
8. Lanzamiento en Aguilares: cómo conseguir los primeros comercios y repartidores a la vez, y qué métricas indican que el MVP funciona.
9. Hosting, despliegue, backups y monitoreo del MVP.
10. Alcance del MVP: qué entra en la primera versión y qué queda para después.
