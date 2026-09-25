# PR #98 — T-311 · Páginas legales y consentimientos versionados

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/98 |
| **Tarea** | T-311 (Fase 3) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-311-legal-consents` → `develop` |
| **Base revisada** | `develop@7edcfe0` |
| **SHA revisado** | `c5c737116a9a55da0dfe78b2fd76c079fcc95520` |
| **Estado** | bloqueada · Ronda 2 |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `09082af` | 9 bloqueantes | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `c5c7371` | 5 bloqueantes · 6 cierres | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---:|---|
| PR98-A01 | Ampliación mínima de alcance | decisión | aceptado |
| PR98-H01 | Sincronía develop/ficha/plan | alto | abierto parcial |
| PR98-H02 | Privacidad incompleta / soporte ficticio | alto | cerrado R2 |
| PR98-H03 | Duración del piloto ausente | medio | cerrado R2 |
| PR98-H04 | Dos autoridades de versión | alto | cerrado R2 |
| PR98-H05 | Falta mismatch en Server Actions | alto | cerrado R2 |
| PR98-H06 | Cuenta puede sobrevivir sin consentimientos | alto | abierto parcial |
| PR98-H07 | Checkboxes sin nombre accesible | medio | cerrado R2 |
| PR98-H08 | P04/axe/capturas sin evidencia | alto | abierto |
| PR98-H09 | Bitácora/body incompatibles | medio | abierto parcial |
| PR98-H10 | Autor escribió carpeta de revisión | medio | cerrado R2 |
| PR98-H11 | Política contradice obligatoriedad real de schemas | alto | nuevo · abierto |

Datos: [`hallazgos.jsonl`](hallazgos.jsonl) · Comandos: [`evidencia/comandos.md`](evidencia/comandos.md)

## Qué queda

Resolver H01, H06, H08, H09 y H11. El autor no toca `docs/revision-pr/**`. Luego pedir Ronda 3.
