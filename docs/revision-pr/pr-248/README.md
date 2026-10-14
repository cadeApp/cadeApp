# PR #248 — T-336 · Navegación de retorno y 404 al home real de la sesión

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/248 |
| **Tarea** | T-336 · issue #247 |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-336-retorno-home-real` → `develop` |
| **Base** | `59d9d1783a936c9c7d5331cc5b2c07b4ed7d05b3` |
| **SHA final verificado** | `ab2f52512a103f81d70bc46bcabe437a02f87439` |
| **Estado** | **SIN BLOQUEANTES — revisión independiente cerrada** |

## Estado final de hallazgos

- PR248-H01 → arreglado-verificado
- PR248-H02 → arreglado-verificado
- PR248-H03 → arreglado-verificado
- PR248-H04 → arreglado-verificado
- PR248-H05 → arreglado-verificado

## Verificación final R7

### Middleware real

- entrypoint movido de `middleware.ts` a `src/middleware.ts`;
- no queda copia activa en raíz;
- `src/middleware.test.ts` prueba la `config` real con `unstable_doesMiddlewareMatch`;
- `package.json` ya no referencia la ubicación legacy.

### Build exact-head

CI run `37192309514`:
- `119/119` archivos de test PASS;
- `1898/1898` tests PASS;
- DB probe: `10/10` PASS;
- DB suite: `1811/1811` PASS;
- lint/typecheck/build/audit/bundle-budget GREEN;
- `ƒ Middleware 136 kB`;
- `/courier/feed = 159 kB`;
- `/courier/profile = 178 kB`.

### Preview / browser real

Vercel del SHA `ab2f52512a103f81d70bc46bcabe437a02f87439`: GREEN.

Trusted e2e-preview run `37192403607`: GREEN.

Resultado:
- Chromium: **21/21 PASS**;
- global-settings: **3/3 PASS**;
- T-336 browser-level: PASS en 11.3 s;
- cookie Supabase presente después del login y del 404;
- courier autenticado:
  `/courier/feed → 404 → Ir al inicio → /courier/feed`;
- sin navegación de rescate, relogin ni retry manual dentro del spec.

La evidencia RED previa queda en run `37190004737`, donde el mismo contrato fallaba tres veces antes de activar el middleware.

## Rama

Al cierre de R7 la rama está `ahead 16 / behind 1` respecto del `develop` actual. Esto no invalida la corrección, pero debe sincronizarse antes del merge si GitHub/flujo del repo lo requiere.

## Resultado

**PR #248 sin bloqueantes técnicos ni de evidencia.**
