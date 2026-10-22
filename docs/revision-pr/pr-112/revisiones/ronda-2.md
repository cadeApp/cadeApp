# PR #112 · T-123 — Ronda 2

- **SHA revisado:** `ae130408eef848f91e31135c531fb5c5b0490215`
- **Estado:** Draft · fase RED
- **Resultado:** **SIN BLOQUEANTES PARA PASAR A IMPLEMENTACIÓN**
- **Cerrados:** H01, H02, H03
- **Decisiones nuevas:** ninguna

## Alcance

Desde la Ronda 1 solo hay un commit funcional (`ae13040`) que modifica:

- tests de A03/A04/A06;
- nuevo stub/test de `RecentSettingChanges`;
- `docs/tasks/T-123.md`;
- bitácora.

No se implementaron todavía actions/queries/components/rutas y no se tocó:
- `supabase/**`;
- dependencias;
- `docs/revision-pr/**` por parte del autor.

## CI del SHA

Run `36302759647`:

```text
typecheck       PASS
lint            PASS
build           PASS
audit           PASS
db-tests        PASS
bundle-budget   PASS
unit            FAIL esperado — fase RED

Test Files      8 failed | 65 passed (73)
Tests           103 failed | 783 passed (886)
```

El incremento de 88 → 103 rojos corresponde a los controles nuevos de Ronda 1. Los 65 archivos que ya estaban verdes permanecen verdes.

## H01 ✅

`merchants-table.test.tsx` ahora separa explícitamente los dos modos:

### Marcar mes pagado

```ts
expect(setMerchantSubscriptionAction).toHaveBeenCalledWith({
  merchantId: MERCHANT_ID,
  subscriptionStatus: 'active',
  paidUntil: '2026-10-31',
});
```

### Extender piloto

```ts
expect(setMerchantSubscriptionAction).toHaveBeenCalledWith({
  merchantId: MERCHANT_ID,
  subscriptionStatus: 'pilot',
  paidUntil: '2026-10-31',
});
```

Los asserts son exactos y ambos tests están RED por ausencia de `Editar plan` en el stub actual.

## H02 ✅

`platform-settings-form.test.tsx` exige los cinco parámetros:

- `min_offer_ars`;
- `request_ttl_minutes`;
- `pilot_active`;
- `pilot_terms_version`;
- `subscription_grace_days`.

También exige:
- switch accesible de piloto;
- boolean real `false`, no string;
- payload exacto para cada setting;
- refresh tras success;
- AAL2 sin refresh;
- panel `RecentSettingChanges`;
- estado vacío del panel;
- operador o Sistema;
- fecha;
- before → after.

`t123-dod.test.ts` además exige que `/admin/settings/page.tsx` invoque:
- `getPlatformSettings()`;
- `getRecentSettingChanges()`;
- y renderice `<RecentSettingChanges`.

El CI confirma RED por stub/ruta ausente.

## H03 ✅

`audit-log-table.test.tsx` ahora exige que el link “Siguiente” conserve:

```text
cursor
actor
action
entity
```

y que los controles GET reflejen los tres filtros activos.

El CI confirma RED por ausencia de UI en el stub actual.

## D05-B

La decisión quedó registrada correctamente en ficha y bitácora como **excepción**, no como cumplimiento de Regla 25.

## Limitación de la revisión

Se intentó preparar checkout local para mutation battery independiente, pero el entorno de revisión no puede resolver `github.com`. No se declara ninguna mutación reviewer-owned que no haya sido ejecutada.

Para esta etapa se verificó:
- RED real en CI contra stubs;
- estructura exacta de los asserts;
- ausencia de adulteración de fixtures/expectativas;
- continuidad de los tests previamente verdes.

Las mutaciones concretas indicadas en Ronda 1 deberán demostrarse al llevar cada control a GREEN durante la implementación.

## Resultado

**La fase RED queda aprobada para continuar con implementación.**

La PR **NO está lista para merge** y debe permanecer Draft mientras A03/A04/A06 sigan sin implementar.
