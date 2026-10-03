# Ronda 3 — PR #179 / T-304

**Fecha:** 2026-10-02  
**SHA funcional:** `df768471704ced79f863eb6040764fd081f3dbc7`  
**develop actual:** `2e43d71eadd13acf5e92fee5a0142d678fd79059`  
**Resultado:** **CON BLOQUEANTES (7)**

## Preflight

- PR #179 abierta, ya no Draft.
- HEAD: `df768471704ced79f863eb6040764fd081f3dbc7`.
- CI general: GREEN.
- approval-policy: GREEN, pero existe una aprobación antigua; no se considera aprobación de esta ronda.
- Vercel Preview: GREEN.
- `e2e-preview`: **FAILURE**, run `37081233672`.
- Playwright remoto: **16 passed, 3 failed T-304, 1 flaky T-303**.
- Rama: ahead 13 / behind 4.
- Los 4 commits faltantes de develop no pisan archivos de T-304 ni el arnés E2E.
- El autor preservó intactos todos los archivos `docs/revision-pr/pr-179/**` de R2.

## Resolución de hallazgos anteriores

### H01 — VERIFICADO
El spec atraviesa auth/RPC/persistencia reales. El run remoto prueba que Filas 1–7 operan contra Supabase Develop.

### H02 — PARCIAL
Los efectos persistidos de Filas 1–7 quedaron demostrados. Los residuales de Filas 8/9 e invariante dependen de H11/H12/H15.

### H03 — SIGUE BLOQUEANTE
Ahora sí existe Playwright real, pero el RED observado es del arnés, no una mutación de regla de negocio. Las cuatro mutaciones documentadas siguen ejecutando `pnpm vitest run src/domain/domain.test.ts`.

No mutar la lógica compartida de Supabase Develop. La prueba RED puede hacerse de forma segura alterando temporalmente **solo filas propiedad de la corrida** después de la transición real para demostrar que los asserts postcondición detectan estado incorrecto; luego revertir el código temporal y limpiar.

### H04 — REABIERTO
El body marca como cumplidos:
- cobertura completa;
- efectos persistidos;
- RED reproducible;

aunque `e2e-preview` está RED y H03/H11-H15 siguen abiertos. El checkbox Playwright GREEN correctamente sigue desmarcado, pero los otros claims también deben volver a pendiente hasta tener evidencia.

### H06 — VERIFICADO
El orden FK request → offer → accepted_offer_id quedó correcto. Filas 5, 6a, 6b y 7 pasaron en runtime remoto.

### H07 — VERIFICADO
PR #207 está mergeada y el run `37081233672` ejecutó realmente `request-states.spec.ts`.

### H08 — VERIFICADO
Fila 4 espera `REQUEST_EXPIRED` y pasó en Preview.

### H09 — PARCIAL
La mayor parte de los huecos quedó corregida y Filas 1–7 pasan. Los residuales se separan ahora en H12-H15.

### H10 — SIGUE BLOQUEANTE
La rama quedó 4 commits detrás de develop. No hay overlap, pero antes de R4 debe quedar behind=0 y repetir los gates exact-head.

---

## H11 · Cleanup no elimina incidents antes del request · BLOQUEANTE ALTO

El contexto ya rastrea `createdIncidentIds`, pero `cleanupStagingData` no descubre/borrar incidents antes de `delivery_requests`.

Runtime:

```text
Fila 8 body: llega a crear incidente real.
teardown:
delivery_requests -> FK incidents_request_id_fkey
profiles -> FK incidents_reporter_id_fkey
merchants/zones/auth.users quedan encadenados
```

Esto contamina Supabase Develop y provoca fallos posteriores.

**Corrección:** descubrir incidents por `request_id` de la corrida, incorporarlos a `createdIncidentIds`, borrarlos antes de contactos/offers/request (o al menos antes de request/profile), y solo retirar IDs del tracking cuando el delete haya sido exitoso. Agregar tests de orden y error.

## H12 · seedAdminUser viola el bootstrap de auth · BLOQUEANTE ALTO

`seedAdminUser` crea:

```ts
user_metadata: { role: 'admin' }
```

pero `schema_v1.sql` dice explícitamente:

```sql
if requested_role not in ('merchant', 'courier') then
  raise INVALID_SIGNUP_ROLE;
end if;
```

y documenta que el bootstrap de admin se hace creando un usuario permitido y promoviendo `profiles.role` con service-role.

Runtime:

```text
Fila 9 -> Database error creating new user
Invariante delivered -> mismo error
```

**Corrección:** usar el bootstrap permitido; eliminar la fila de subtipo temporal creada por el trigger y promover el profile a admin con service-role. Mantener cleanup seguro y tests que ejecuten la secuencia esperada.

## H13 · Oráculo TTL fail-open · BLOQUEANTE MEDIO

`getPlatformSettingNumber()` devuelve `defaultValue` ante error/no-data/valor inválido. El spec lo llama con default `45`.

Eso permite afirmar “leímos el setting real” aun si la lectura falló y el valor real coincide casualmente con 45.

**Corrección:** para un helper usado como oráculo contractual, error/no-row/no-numérico debe lanzar `E2E Inspection Error`; el spec no debe pasar un fallback.

## H14 · El “gap de notificación” documentado es falso · BLOQUEANTE MEDIO

El comentario del spec y el body dicen que `matched -> cancelled` no tiene notificación observable.

Pero la implementación vigente sí la tiene en capa server:

- `src/server/rpc/requests.ts:111+` entra a la rama `cancel_request`;
- resuelve ofertas afectadas/actor;
- `src/server/rpc/requests.ts:168-170` llama `safeNotifyPostTransition(..., { event: 'request_cancelled' })`;
- `src/server/rpc/requests.test.ts:691+` cubre específicamente merchant matched → push al courier aceptado.

El E2E de T-304 llama `client.rpc()` directamente, por eso salta deliberadamente esa capa.

**Corrección:** no implementar push nuevo ni ampliar scope. Corregir comentario/body/bitácora: no es un gap; es una responsabilidad ya cableada y cubierta por tests de T-206/PR118, fuera del mecanismo directo-RPC de este spec.

## H15 · Ventana >24 h no comprueba ausencia de escritura · BLOQUEANTE MEDIO

Fila 8 comprueba `INCIDENT_WINDOW_EXPIRED`, pero termina inmediatamente después. Falta releer `expiredRequestId` y verificar que no apareció ningún incidente.

**Corrección:** después del error, `getRequestInspectionData(...expiredRequestId)` y `incidents.length === 0`.

## Evidencia runtime

Run confiable: `37081233672`.

Resultado T-304:
- Filas 1–7: GREEN.
- Fila 8: cuerpo funcional llega al final; falla cleanup por FK de incidents.
- Fila 9: no arranca lógica de negocio; falla `seedAdminUser`.
- Invariante delivered: no arranca cancelaciones admin; falla `seedAdminUser`.
- Smoke: GREEN.
- T-303 main-flow: flaky pero termina pasando; no bloquea T-304.

## Criterio para Ronda 4

1. H11 cleanup correcto y sin residuos.
2. H12 bootstrap admin real funcionando.
3. H13 oráculo TTL fail-closed.
4. H14 documentación corregida sin inventar gap.
5. H15 postcondition de no-incidente.
6. H03 RED seguro y reproducible sobre el E2E/postcondiciones reales.
7. Merge de `origin/develop` → behind=0.
8. `e2e-preview` GREEN en el HEAD exacto.
9. Body/ficha/bitácora solo marcan checks realmente verificados.
10. `docs/revision-pr/pr-179/**` permanece intacto para el autor.
