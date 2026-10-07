# PR #251 — T-313 · E2E de registro de comercio y consentimientos

> ❌ Ronda 8 · CON BLOQUEANTES (2) · H04 + H10

| Campo | Valor |
|---|---|
| PR | #251 · `feat/T-313-merchant-registration-e2e` → `develop` |
| Tarea | T-313 |
| Autor | KiraK72 |
| SHA funcional revisado | `b62331f5c96b2c79da5fac2960bf7e9baa815210` |
| Commit previo de revisión | `d8085beb7b2a0fe54db5d32382c765990811aa64` |
| `develop` actual | `64dfdf653219c6cf08a223c0df829353d9d9d8f1` |
| Sincronización | 27 ahead / 1 behind |
| CI | `37567209715` · GREEN |
| e2e-preview | `37567338127` · 44 passed / 1 failed |
| P3 | visto bueno pendiente |

## Estado

- ✅ H01 — cobertura completa de `(merchant)`.
- ✅ H02 — doble error test/cleanup.
- ✅ H03 — checklist/evidencia coherentes en la ronda que lo cerró.
- ❌ H04 — falta baseline GREEN + D02-A RED + revert + GREEN final; el baseline ahora falla durante el onboarding del comercio.
- ✅ H05 — cleanup robusto del alta.
- ✅ H06 — rol merchant demostrado con RED/revert.
- ✅ H07 — causa SMTP no sobreatribuida.
- ✅ H08 — body con template.
- ✅ H09 — selector de alert acotado al formulario y revalidado en Preview.
- ❌ H10 — el body de la PR quedó con evidencia obsoleta y atribuye el bloqueo al viejo error de Auth.

## Diagnóstico actual

El trusted Preview del SHA revisado ejecutó exactamente ese SHA y dejó T-313 así:

- alta/consentimientos: ❌ el registro inicial avanza, pero el submit de `/merchant/onboarding` devuelve `INTERNAL_ERROR` y permanece en `/merchant/onboarding`;
- courier fuera de `(merchant)`: ✅;
- comercio sin consentimiento fuera del panel: ✅.

La revisión enumeró los cuatro puntos que pueden producir ese `INTERNAL_ERROR` dentro de `merchantOnboardingAction`: lectura/validación de `pilot_terms_version`, upsert de `pilot_terms`, update de `profiles` y upsert de `merchants`. El artifact/trace no identifica cuál de esos cuatro falló y no hay logs runtime que lo desambigüen.

No se atribuye una causa raíz sin evidencia.

No apruebo ni mergeo.
