# Evidencia de ejecución — revision-3 (Geolocalización, Mapas y Distancia en Servidor)

- Fecha: 2026-09-18 · Comando: `revisar` · Protocolo: runtime-contract v1
- Candidato: Cambio solicitado por Lautaro073 (Dueño del producto): selección de pin en mapa de Aguilares para comercio y solicitudes, visualización de recorrido para repartidor aceptado, y cálculo de distancia en servidor.
- Estado final: **APROBADO CON CONDICIONES** (8 dictámenes `conditional`, 0 `block`; decisiones D15 incorporadas y 2 fallos técnicos adjudicados).

## 1. Intake y Decisiones Previas
- **Decisión D15 (Lautaro073):**
  1. Antes de ofertar, el repartidor ve únicamente: barrio de retiro, barrio de entrega, tipo de paquete, medio de pago y la distancia aproximada entre puntos, calculada en el servidor con los puntos exactos y redondeada a múltiplos de 0,5 km. No recibe coordenadas ni mapa.
  2. Al aceptar su oferta (`matched`), el repartidor ve el mapa con los dos puntos exactos, el recorrido y el botón "Abrir en Google Maps". D3 sigue plenamente vigente.
  3. El punto del local sigue la misma regla: antes de ofertar solo el barrio; el punto exacto se revela al aceptar.
  4. D7 sigue 100% vigente: no hay seguimiento en vivo (live tracking), no hay GPS en segundo plano del repartidor, ni ranking de cercanía.

## 2. Participantes
- Activados por pedido de Lautaro073: `pm`, `ux-ui`, `frontend`, `backend`, `security`, `legal`, `finance`, `qa`.
- Adjudicador: `judge`.

## 3. Dictámenes y Consenso
| Rol | Dictamen | Confianza | Foco principal |
|---|---|---|---|
| **pm** | conditional | 0.94 | Valida D15 como solución a la falta de numeración en Aguilares; exige fallback a texto y zones. |
| **ux-ui** | conditional | 0.92 | Pin accesible con crosshair fijo y mapa desplazable en mobile; botón "Abrir en Google Maps" de 48px; avisos claros en T03. |
| **frontend** | conditional | 0.93 | `@vis.gl/react-google-maps` con `next/dynamic` ({ ssr: false }) para proteger presupuesto de 180 KB JS. |
| **backend** | conditional | 0.95 | Coordenadas en `delivery_request_contacts` y `merchants`; función Haversine x 1.30 redondeada en Postgres; bounding box Aguilares; fallback a `zones`. |
| **security** | conditional | 0.96 | RLS estricta para lat/lng; prohibición de coordenadas en logs, push o URLs; API key restringida por Referrer y API scope. |
| **legal** | conditional | 0.91 | Datos de localización minimizados bajo Ley 25.326; ausencia de tracking protege contra presunción laboral (Ley 20.744). |
| **finance** | conditional | 0.95 | Verificación de precios Google Maps (marzo 2025): 10.000 llamadas gratis/mes por SKU Essentials. Piloto consume ~1.820 cargas ($0 USD). Quota caps obligatorios. |
| **qa** | conditional | 0.94 | Mocks en Playwright para CI ($0 consumo de API); pgTAP de RLS de coordenadas; nueva tarea T-314 para suite E2E de mapas. |

## 4. Adjudicaciones Técnicas
1. **Proveedor y costo (`conf-proveedor-mapas-costo`):** Gana Google Maps Platform con `@vis.gl/react-google-maps`. Razón: 10.000 cargas gratuitas mensuales cubren el piloto con $0 USD; cartografía superior en Aguilares; botón directo a la app nativa Google Maps. Se mitiga con Quota Cap de 9.500 cargas/mes y alerta a $1 USD en Google Cloud Billing.
2. **Distancia y ruteo (`conf-calculo-distancia-rutas-vs-haversine`):** Gana cálculo esférico Haversine x 1.30 en Postgres con redondeo a 0.5 km. Razón: 0ms de latencia externa, $0 costo, sin llamadas a Routes API. Los centroides de `zones` quedan como fallback si no hay coordenadas.

## 5. Nuevas Tareas Incorporadas en el Plan
- **T-106 (P1 · Lautaro073):** Migración, RLS de coordenadas y RPC `calculate_route_distance` con Haversine x 1.30 y validación de bounding box de Aguilares.
- **T-116 (P2):** Componente `src/ui/map.tsx` (import dinámico), selector de pin en alta de comercio (C01) y en nueva solicitud (C03) con fallback a texto.
- **T-117 (P2):** Mapa de recorrido y botón "Abrir en Google Maps" en viaje activo (C06, R07), garantizando que R04 y R05 no incluyan mapas ni coordenadas.
- **T-314 (P3):** Suite E2E (`e2e/specs/map-privacy.spec.ts`) con mocks de Maps, validación de bounding box y pruebas de degradación graceful.

## 6. Verificaciones Realizadas
- Coherencia de tableros (§7) y matriz (§10) con las nuevas tareas T-106, T-116, T-117 y T-314.
- Verificación de precios oficiales de Google Maps Platform vigentes a marzo de 2025.
- Bounding box de Aguilares: lat -27.4550 a -27.4100, lng -65.6400 a -65.5950.
- Prompts de Stitch actualizados eliminando restricciones obsoletas de mapas pero ratificando la prohibición de live tracking.
