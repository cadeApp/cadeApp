# Revisión independiente — ronda 1 — PR #618 — 2026-11-05

**Tarea:** CC-045 / T-423. **SHA original:** `d35138babfd6133eefa986e27f25f806aafb461c`. **Base:** `a7c6d809f87804415499d7fc70aaf06349717c16`. **Rama:** `cc/CC-045-map-geocoding`. **Alcance:** exclusivamente documentación (5 archivos). La ficha T-423 **no existía** en la base `develop`; se contrastó con la fila de plan añadida, issues #615/#616 y `src/ui/map.tsx` de `develop`.

## Dictamen

**SIN BLOQUEANTES para mergear este CC documental**, tras correcciones mínimas en la propia rama. **No equivale a aprobar ni ejecutar la funcionalidad** de Geocoding: T-423 aún no implementa código. El envío real de direcciones a Google queda condicionado al issue #619 de transparencia y política legal versionada. La autorización de Lautaro073 para tomar decisiones y mergear fue explícita en la conversación del 2026-11-05; no se simula aprobación de P2.

## Hallazgos y correcciones

### PR618-H01 — BLOQUEANTE original · DoD vs. fila del plan

**`docs/tasks/T-423.md`, sección DoD (primer ítem).** El primer ítem no era idéntico a la celda de DoD de `docs/implementation-plan.md`, como exige `tools/verify-fichas.test.ts`. El job `unit` del SHA `d35138b` ejecutó **3568 tests, 1 fallido**, el de sincronía T-423; no fue una falla aleatoria. **Corrección:** primer ítem copiado completo y fiel desde la fila de plan sin debilitar pruebas, commit `03420fe`. Control de igualdad y mutación documental: verde/rojo comprobados consultando el contenido del SHA corregido. Nuevo CI por confirmar al registrar esta ronda.

### PR618-H02 — BLOQUEANTE original · Bounds incompatible con Google

**`docs/contracts/CC-045.md`, sección Comportamiento.** El ejemplo mandaba `bounds: AGUILARES_BOUNDS`, pero el objeto local tiene `minLat/maxLat/minLng/maxLng` y `GeocoderRequest.bounds` exige `google.maps.LatLngBoundsLiteral` con `south/north/west/east`; pasar el objeto original sin conversión da error de tipos o ejecución. **Corrección:** el CC especifica la conversión explícita, distingue sesgo de límites de validación estricta y añade test de argumentos. **Fuente externa:** https://developers.google.com/maps/documentation/javascript/reference/coordinates (LatLngBoundsLiteral).

### PR618-H03 — MEJORA funcional original · Precisión interpolada marcada exacta

**`docs/contracts/CC-045.md`, helper `interpretGeocodeResponse`.** El contrato solo marcaba `APPROXIMATE` y `GEOMETRIC_CENTER` (o `partial_match`) como aproximados; omitía `RANGE_INTERPOLATED`. Esto haría que la UI aconsejara «pin en la puerta» con una ubicación interpolada. **Corrección:** `RANGE_INTERPOLATED` también es aproximado y se incluye un caso unitario. **Fuente:** https://developers.google.com/maps/documentation/javascript/reference/geocoder (GeocoderLocationType).

### PR618-H04 — BLOQUEANTE original · Carrera consulta vs. selección manual

**`docs/contracts/CC-045.md`, Concurrencia/Comportamiento, y `docs/tasks/T-423.md`, Diseño/DoD.** La condición «solo última búsqueda por `id`» no protege esta secuencia: blur dispara geocoder → usuario arrastra el pin o elige GPS → responde *la misma* búsqueda, todavía la última → pisa la elección. Contradice «pin manual manda». **Corrección:** invalidar también por revisión/época de selección ante click, drag, teclado, GPS y cambio externo mientras la promesa está pendiente; no aplicar un resultado obsoleto ni dejar indicador pending. Se añadió caso de prueba exacto. **Estado:** solo contrato/documentación; el comportamiento real debe demostrarse RED→GREEN en T-423.

### PR618-H05 — MEJORA / puerta de rollout · Privacidad de direcciones a Google

**`src/features/legal/documents.ts` (base), Política de Privacidad v1.1 §6 y §8; `docs/contracts/CC-045.md`, Privacidad.** La política describe transferencias tecnológicas y acceso restringido, pero no identifica específicamente el nuevo envío de dirección de destinatario no usuario a Google por Geocoding. **No es un incidente probado de divulgación** (este PR es documental); es un requisito de transparencia que debe quedar cubierto antes de activar T-423. **Decisión aplicada:** crear #619 y condicionarlo en CC y DoD, sin mezclar un cambio legal sustancial en este PR de contratos.

## Alcance y seguridad

- Cambios originales: `AGENTS.md`, `docs/contracts/CC-045.md`, `docs/implementation-plan.md`, `docs/master-plan.md`, `docs/tasks/T-423.md`. No hay archivos ajenos al CC documental; la nueva ficha lista sus archivos futuros permitidos.
- Sin migraciones ni RPC, claves nuevas, cambios en `src/ui` o datos reales. `src/ui/map.tsx` actual usa `AGUILARES_BOUNDS` con nombres `minLat/maxLat/minLng/maxLng` y `APIProvider` interno.
- Decisiones: D01=A (blur + botón), D02=A (Maps en el cliente), D03=A (Google como excepción), se mantienen; en T-423 el retiro de «Crear solicitud» queda fuera por no tener mapa, pero alta/edición de comercio permanece incluida. #619 exige información externa a los documentos internos.
- No se corrieron tests locales de repositorio porque el entorno no puede resolver github.com para clonar; no se levantó Supabase/Docker ni se usó producción. Control documental propio de cinco afirmaciones con cinco mutaciones en memoria: las cinco verdes con documentación corregida y las cinco rojas mutadas (script íntegro en evidencia). Esto **no sustituye tests React/Playwright** del futuro T-423.
- CI inicial SHA `d35138b`: typecheck ✅, lint ✅, build ✅, unit ❌ (solo `tools/verify-fichas.test.ts`, 1/3568), otros jobs en curso al momento de lectura. CI de commits documentales posteriores: pendiente en esta captura. `approval-policy` inicial ❌ por ausencia de informe completo en el cuerpo del PR (se agrega informe al terminar).
- No se auditó Google Cloud Console ni permisos/cupos de la API declarados «hechos». No interpretar un éxito genérico de CI como prueba de ejecución de Geocoding.

## Próximos controles en T-423

1. `interpretGeocodeResponse`: falso «exacto» al mutar `RANGE_INTERPOLATED` a respuesta no aproximada → test rojo.
2. `MapPicker`: resolver geocoder luego de arrastrar el marcador/GPS sin cambio de id → coordenadas manuales deben permanecer, caso rojo si se quita invalidación por revisión.
3. `GeocoderRequest.bounds`: inspeccionar argumento `south/north/west/east`; mutar a `AGUILARES_BOUNDS` crudo → rojo.
4. Promise `ZERO_RESULTS` rechazada → `not_found` sin rechazo sin capturar y sin mover pin.
5. Formulario con Maps no disponible → `unavailable` inline y envío válido; E2E con stub realista, red de Google interceptada sin consultas reales.

**Informe revisar-pr — T-423 — 2026-11-05 — generado por revisión independiente**
**Resultado: SIN BLOQUEANTES para el CC documental.**
**Checks locales:** typecheck n/e · lint n/e · test n/e · test:db n.a. (solo docs; CI GitHub evaluada por SHA).
**BLOQUEANTES:** H01, H02, H04 fueron corregidos en documentación; para implementar T-423 se requieren las pruebas descritas.
**MEJORAS:** H03 corregida en contrato; H05 registrada en #619, puerta de rollout.
**No revisado / dudas para Lautaro073:** configuración de Google Cloud no verificada; ninguna decisión pendiente en esta PR.
