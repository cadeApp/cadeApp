# PR #251 — T-313 · E2E de registro de comercio y consentimientos

> ❌ Ronda 2 · CON BLOQUEANTES (1) · 3 de 4 hallazgos cerrados

| Campo | Valor |
|---|---|
| PR | #251 · `feat/T-313-merchant-registration-e2e` → `develop` |
| Tarea | T-313 · Issue #45 |
| Autor | KiraK72 |
| SHA ronda 1 | `afdb326128cef1972b42bb3822a43cbd468fbd61` |
| SHA ronda 2 | `79c6985e8c9717cf00f28c1baa6e7e4fbd38e726` |
| `develop` al revisar | `1cd3da01b3af9619e4a19107ba5e8354a18c2159` |
| Sincronización | 6 ahead / 3 behind |

## Rondas
| Ronda | SHA | Resultado |
|---|---|---|
| 1 | `afdb326` | ❌ 4 bloqueantes |
| 2 | `79c6985` | ❌ 1 bloqueante · H01/H02/H03 cerrados |

## Estado
- ✅ H01 — cobertura completa de `(merchant)`.
- ✅ H02 — lifecycle error conserva error principal + cleanup.
- ✅ H03 — body/bitácora alineados; CI integrado verde.
- ❌ H04 — falta RED comportamental; el `e2e-preview` del SHA revisado aún no terminó.

Condiciones adicionales de cierre:
- rama 3 commits detrás de `develop`;
- visto bueno explícito P3 pendiente;
- GREEN de `e2e-preview` requerido sobre el HEAD final sincronizado.

D01 se mantiene: Develop/Preview no depende de SMTP real; Staging conserva SMTP/sender.

No apruebo ni mergeo.
