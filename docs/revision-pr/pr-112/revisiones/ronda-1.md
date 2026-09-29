# PR #112 · T-123 — Ronda 1

- **SHA:** `1960d016e7fc88ba0c788f3fad919148068de3a2`
- **Base:** `7f392e9f0fc020f9dcf6838d1638cbbe4004d7ac`
- **Estado:** Draft · fase RED
- **Resultado:** **CON BLOQUEANTES (3)**
- **Decisión nueva:** D05-B

## Preflight

- PR mergeable: sí, pero Draft.
- Cambios dentro del alcance declarado de feature/ficha/bitácora.
- No existe aún implementación de rutas A03/A04/A06, coherente con fase RED.
- CI run `36301571013`:
  - typecheck ✅
  - lint ✅
  - build ✅
  - audit ✅
  - db-tests ✅
  - bundle-budget ✅
  - unit ❌: **7 archivos / 88 tests fallan**, **65 archivos / 782 tests pasan**.
- Los fallos inspeccionados corresponden a stubs/rutas inexistentes T-123; no aparecen regresiones de T-122 en el log.

## Validez de la fase RED

La fase RED es real: los componentes devuelven `null`, actions/queries/parsers lanzan `T-123: sin implementar` y las rutas aún no existen. Los tests de comportamiento fallan por esas propiedades, no por typecheck/lint roto.

No obstante, antes de implementar hay tres huecos que permitirían una implementación incompleta con suite verde.

## PR112-H01 — BLOQUEANTE

### A03 no demuestra la semántica de «Marcar mes pagado»

En `merchants-table.test.tsx`, el comercio parte de:

```ts
subscriptionStatus: 'pilot',
paidUntil: null,
```

pero el test “registra un pago manual” espera:

```ts
subscriptionStatus: 'pilot',
paidUntil: '2026-10-31',
```

Eso no distingue “extender piloto” de “marcar mes pagado”. Una implementación que solo cargue `paid_until` y nunca active la suscripción podría pasar.

### RED que debe agregarse

Test específico:

1. abrir “Editar plan” sobre comercio `pilot`;
2. elegir **Marcar mes pagado**;
3. ingresar `2026-10-31`;
4. Guardar;
5. exigir exactamente:

```ts
expect(setMerchantSubscriptionAction).toHaveBeenCalledWith({
  merchantId: MERCHANT_ID,
  subscriptionStatus: 'active',
  paidUntil: '2026-10-31',
});
```

Agregar además un test independiente de **Extender piloto** que conserve `subscriptionStatus:'pilot'`.

Mutación RED posterior: cambiar “Marcar mes pagado” para enviar `pilot` debe romper el primer test.

---

## PR112-H02 — BLOQUEANTE

### A04 puede omitir `pilot_active` y el panel «Últimos cambios»

La UI vinculante de A04 tiene cinco parámetros. El test “muestra los valores” comprueba cuatro inputs pero nunca `pilotActive`.

Los action tests sí cubren la clave, pero una pantalla que nunca muestre el switch puede quedar verde.

Además D04 dice que “Últimos cambios” es server-side, pero no hay un control que obligue a la page a invocar `getRecentSettingChanges()` y renderizar esos datos.

### RED que debe agregarse

#### Switch piloto

En `platform-settings-form.test.tsx`:

- con `pilotActive:true`, exigir un control accesible `role="switch"` o checkbox con nombre `/piloto activo/i` y estado checked;
- cambiarlo a false;
- Guardar;
- exigir:

```ts
expect(updatePlatformSettingAction).toHaveBeenCalledWith({
  key: 'pilot_active',
  value: false,
});
```

- success → `router.refresh()`;
- error AAL2 → muestra DomainError y no refresh.

Mutación RED: omitir el switch o enviar string `"false"` debe fallar.

#### Panel últimos cambios

Agregar control de ruta/feature que exija que `/admin/settings/page.tsx`:
- importe `getPlatformSettings` y `getRecentSettingChanges` desde `@/features/admin/server`;
- invoque ambos server-side;
- renderice el historial recibido en un componente de feature.

Ideal: crear un componente `RecentSettingChanges` bajo `src/features/admin/components/**` y testearlo con al menos dos eventos.

Mutación RED: quitar `getRecentSettingChanges` de la page debe romper el test.

---

## PR112-H03 — BLOQUEANTE

### A06 pierde cobertura del filtro `action` al paginar

El test actual usa:

```ts
filters={{ actorId: ACTOR_ID, targetType: 'platform_setting' }}
```

y comprueba `cursor`, `actor`, `entity`. Nunca prueba `action`.

### RED exacto

Modificar el fixture del test de paginación a:

```ts
filters={{
  actorId: ACTOR_ID,
  action: 'admin_update_setting',
  targetType: 'platform_setting',
}}
```

y agregar:

```ts
expect(url.searchParams.get('action')).toBe('admin_update_setting');
```

También comprobar que el select/input de evento muestre el filtro activo.

Mutación RED: construir el href sin copiar `filters.action` debe romper el test.

---

## D05-B — excepción aceptada

Regla 25 pide índice + prueba RLS para toda consulta nueva. A06 introduce filtros por `actor_id`, `action`, `target_type` con paginación por `id`.

Lautaro073 eligió **D05-B**:
- T-123 no toca `supabase/**`;
- se usan las policies/índices actuales;
- no se agregan tests DB específicos en esta PR;
- esta excepción debe quedar documentada en `docs/tasks/T-123.md` y bitácora;
- la deuda de índice/cobertura RLS se deriva a tarea posterior.

Esto es una excepción aceptada, **no una verificación de performance/RLS específica**.

## Resultado

La fase RED es válida en lo estructural, pero **no comenzar implementación todavía** hasta agregar los tres controles anteriores y demostrar que quedan rojos con los stubs actuales.
