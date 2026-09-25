# PR #101 — CC-007 · Enforcement de consentimiento legal

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/101 |
| **Issue** | #100 |
| **Rama** | `cc/CC-007-consent-enforcement` → `develop` |
| **SHA revisado** | `203654e6d8e7857da12295f3ef83a7b0a9282713` |
| **Estado** | bloqueada · Ronda 1 |
| **Bloquea** | T-311 / PR #98 |

## Rondas

| Ronda | SHA | Resultado | Informe |
|---|---|---|---|
| 1 | `203654e` | 7 bloqueantes + 3 decisiones P1 | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |

## Decisiones P1

- **A01 / D06:** doble barrera completa: estado en perfil + activación atómica DB + RLS/RPC como autoridad + auth server/guards como UX.
- **A02 / D07:** merchant/courier sujetos al gate; admin exento; backfill solo activo con TOS+Privacy existentes.
- **A03 / D08:** estados `pending | active | reconsent_required`; una versión nueva solo fuerza reconsentimiento si el cambio es material.

## Bloqueantes

H01–H07 permanecen abiertos. El más importante es H05: PR #101 no puede mergearse como documento solamente; debe implementar el contrato compartido antes de desbloquear T-311.

No se inspecciona CI final mientras existan estos bloqueantes.
