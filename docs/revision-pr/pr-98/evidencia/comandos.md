# Comandos reproducibles — PR #98

## Ronda 4 — SHA cccb88c

### E4-1 · PK que rompe courier onboarding

En `supabase/migrations/20260922031435_schema_v1.sql`:

```sql
create table public.consents (
  ...
  primary key (profile_id, document, version)
);
```

Registro/CC-007 persiste TOS + Privacy. Courier onboarding vuelve a insertar TOS + Privacy + courier_contract con plain INSERT.

Criterio: con las dos primeras filas ya existentes, el statement real debe producir unique violation.

### E4-2 · Idempotencia esperada

Después del arreglo:
1. onboarding escribe consentimiento;
2. simular fallo en paso posterior;
3. reintentar misma versión;
4. no debe fallar por duplicado;
5. `accepted_at` existente no debe reescribirse.

Mutación:
- reemplazar temporalmente el upsert idempotente por insert;
- el test dirigido de reintento debe quedar rojo.

### E4-3 · H12

```bash
rg -n "\\bas any\\b|:\\s*any\\b" src/features/legal/legal-red.test.ts
```

Esperado: cero usos de tipos/casts any.

### E4-4 · H08

Árbol del SHA revisado:
```text
sin evidence/*.png
sin legal_390/register_390
sin salida axe
```

`components-a11y.test.tsx` usa `auditDomAccessibilityStructure`, no axe.

Requerido:
```text
390x844 /legal + documento largo
360x800 /legal + documento largo
axe AA: legal/auth/merchant/courier onboarding
```

### CI

No se inspecciona CI final mientras H08/H13 sigan abiertos.
