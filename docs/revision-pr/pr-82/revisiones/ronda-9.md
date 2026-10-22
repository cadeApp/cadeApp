# Informe de Revisión — PR #82 — Ronda 9

- **Tarea:** `T-204`
- **SHA revisado:** `754161b2edeaea116c97864524875402ec2a7689`
- **Resultado:** ❌ **CON BLOQUEANTES (2)**
- **Decisión D05:** `1-A` — mantener presupuesto First Load JS <=180 kB; no autorizar excepción de 205 kB.

## Estado de H31

El lazy import de `@/lib/supabase/browser` es correcto y reduce:

```text
R8: /courier/feed   273 kB
R8: /courier/offers 273 kB
R9: /courier/feed   205 kB
R9: /courier/offers 205 kB
```

Mejora: -68 kB por ruta. Aun así sigue +25 kB sobre el máximo normativo de 180 kB de `.agents/rules/25-stack-y-patrones.md §6`.

Por decisión D05/1-A, H31 sigue bloqueante. No se sube el presupuesto.

## PR82-H32 — 7 tests rojos tras el setup async de Realtime

CI exact-head run `36299955270`:

```text
Test Files 4 failed | 71 passed (75)
Tests      7 failed | 830 passed (837)
```

Fallan:
- `src/features/requests/hooks/use-request-offers.test.tsx` — 2
- `src/features/offers/hooks/use-available-requests.test.tsx` — 2
- `src/features/requests/components/request-offers.test.tsx` — 1
- `src/features/trips/hooks/use-trip.test.tsx` — 2

La causa es consistente: las pruebas siguen asumiendo que `useRealtimeInvalidation` se suscribe sincrónicamente. Deben esperar la resolución de `import()` antes de afirmar `subscribe`, disparar callbacks o desmontar.

## Checks

- typecheck ✅
- lint ✅
- db-tests ✅
- audit ✅
- build ✅
- bundle-budget job ✅ advisory, pero `/courier/feed` y `/courier/offers` = 205 kB ❌
- unit ❌ 7 tests

## Próximo arreglo

1. Mantener lazy Supabase.
2. Corregir las 4 suites consumidoras para esperar el setup asíncrono.
3. Optimizar el remanente del bundle sin tocar la regla de 180 kB.
4. Revalidar full CI exact-head.
