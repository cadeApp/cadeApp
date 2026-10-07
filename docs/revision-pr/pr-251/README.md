# PR #251 — T-313 · E2E de registro de comercio y consentimientos

> ❌ Ronda 11 · CON BLOQUEANTES (2) · H04 + H10 · P3 pendiente

| Campo | Valor |
|---|---|
| PR | #251 · `feat/T-313-merchant-registration-e2e` → `develop` |
| Tarea | T-313 |
| Autor | KiraK72 |
| SHA revisado | `9d0556ab56f581f95850fbbd319d0908f88d97e1` |
| `develop` | `284683b65e25e10b94e9286a03b4fc85a2cfada3` |
| Sincronización | 42 ahead / 0 behind |
| CI | `37668929864` · GREEN |
| approval-policy | `37669016744` · GREEN |
| Vercel | GREEN |
| e2e-preview | `37669080365` · BLOCKED / REQUIRES DEVELOP MIGRATION |
| P3 | visto bueno explícito pendiente |

## Estado

- ✅ H01–H03.
- ❌ H04 — falta baseline T-313 GREEN + RED discriminante de courier + restauración + GREEN final.
- ✅ H05–H09.
- ❌ H10 — el body sigue sin evidencia E2E final y debe reflejar el split de migración decidido en esta ronda.
- ✅ H11 — corregido y revalidado en `9d0556a`: action usa UPDATE fail-closed, unit GREEN y pgTAP GREEN con la policy nueva.

## Decisiones

### D03-A — vigente en su parte de código productivo

La corrección productiva de H11 sigue autorizada:
- `merchantOnboardingAction` actualiza la fila `merchants` precreada;
- no existe INSERT self;
- no usa admin/service role para persistir merchant;
- `subscription_status` y `paid_until` continúan protegidos.

### D04-A — Lautaro073 · ronda 11

Para poder ejecutar el trusted Preview antes de mergear #251:

**se separan únicamente la migración RLS de H11 y su cambio pgTAP a una PR previa.**

La PR previa parte de `develop` e incluye:
- `supabase/migrations/20261007081131_t313_merchant_onboarding_update_policy.sql`;
- el cambio T-313/H11 de `supabase/tests/rls_matrix.sql`;
- la ficha/bitácora estrictamente necesarias para declarar y documentar ese alcance.

Después de mergear esa PR y de que `migrate-develop` aplique la policy:
1. #251 mergea `origin/develop`;
2. migration + pgTAP desaparecen del diff de #251;
3. `e2e-preview` deja de estar bloqueado por migration;
4. se obtiene baseline T-313 GREEN;
5. recién entonces se continúa H04.

No se aplica ninguna migration manualmente a Supabase Develop.

No apruebo ni mergeo.
