# PR #254 — T-302 · E2E de onboarding del repartidor, aprobación con MFA y DNI duplicado

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/254 |
| **Tarea** | T-302 (Fase 3) |
| **Autor** | @asako669 |
| **Rama** | `feat/T-302-courier-onboarding-e2e` → `develop` |
| **Base vigente al revisar R3** | `6e2da8fb02d4797b9add222206342e6055f1d81c` |
| **Head revisado (R3)** | `8a39cab4f7ed740ea7c32e6f8cea14fea3c3760a` |
| **Sincronización** | ahead 8 / behind 48 |
| **Estado** | bloqueada |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `32477a05841ca669ac9ac7a36f929f2261e4c926` | 4 bloqueantes | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `13caf3f68c5c28613487290a0797852c8a161b7c` | 2 bloqueantes nuevos | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |
| 3 | `8a39cab4f7ed740ea7c32e6f8cea14fea3c3760a` | 3 bloqueantes: H05 residual, H07 y R01 | [`revisiones/ronda-3.md`](revisiones/ronda-3.md) |

## Estado por hallazgo

| ID | Título | Estado |
|---|---|---|
| PR254-H01 | La prueba DoD de DNI no ejecuta la deduplicación de producción | arreglado-verificado |
| PR254-H02 | Los flujos UI tienen escapes que permiten verde sin interacción obligatoria | arreglado-verificado |
| PR254-H03 | El courier del fixture ya llega aprobado y con onboarding completo | arreglado-verificado |
| PR254-H04 | El MFA se eleva en otra sesión y la RPC directa oculta el fallo del navegador | arreglado-verificado |
| PR254-H05 | No hay ejecución GREEN del E2E corregido ni mutaciones RED confiables | parcial |
| PR254-H06 | El spec inventa un DNI_HMAC_SECRET alternativo | arreglado-verificado |
| PR254-H07 | La ronda fue pedida con la rama 48 commits detrás de develop | abierto |
| PR254-R01 | Selectores E2E demasiado amplios rompen 3 casos de T-302 en Preview | abierto |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Evidencia: [`evidencia/comandos.md`](evidencia/comandos.md)

## Qué queda por hacer

1. Hacer merge de `origin/develop` en la rama; nunca rebase.
2. Corregir los 3 selectores ambiguos de R01 con selectores accesibles y específicos.
3. Aclarar en una entrada append-only qué mutaciones RED de R2 no fueron reproducibles por el fail-closed local; no presentar intentos bloqueados como RED de la propiedad.
4. Esperar el `e2e-preview` automático del SHA ya sincronizado y exigir GREEN completo.
5. Recién con rama al día y Preview verde pedir Ronda 4; no aprobar ni mergear antes.

## Para el análisis posterior

R3 no agrega AG nueva. R01 es `P07-coincidencia-demasiado-amplia`; H05 vuelve a confirmar pr-63/AG-70; H07 aplica el chequeo de base vigente que ya exige el procedimiento de revisión.