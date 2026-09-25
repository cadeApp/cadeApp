# PR #98 — T-311 · Páginas legales y consentimientos versionados

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/98 |
| **Tarea** | T-311 (Fase 3) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-311-legal-consents` → `develop` |
| **Base revisada** | `develop@7edcfe0` |
| **SHA de implementación revisado** | `09082afba1a054ed634514a06ce467e76780cc58` |
| **Tamaño** | 33 archivos, +939 / -57 |
| **Estado** | bloqueada · Ronda 1 |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `09082af` | 1 decisión aceptada · 9 bloqueantes · 1 proceso | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---:|---|
| PR98-A01 | Ampliación mínima de alcance | decisión | aceptado por P1; falta reflejarla al resolver la ficha |
| PR98-H01 | Rama atrás de develop y documentación legal desincronizada | alto | abierto |
| PR98-H02 | Política de Privacidad incompleta y contacto inexistente | alto | abierto |
| PR98-H03 | Los términos del piloto no fijan la duración decidida | medio | abierto |
| PR98-H04 | Dos fuentes pueden declarar versiones distintas de pilot_terms | alto | abierto |
| PR98-H05 | Los tres flujos carecen de pruebas de mismatch en la Server Action | alto | abierto |
| PR98-H06 | Un fallo guardando consentimientos deja una cuenta creada sin aceptación | alto | abierto |
| PR98-H07 | Dos checkboxes de consentimiento no tienen nombre accesible | medio | abierto |
| PR98-H08 | P04/axe/capturas se marcan hechos sin evidencia reproducible | alto | abierto |
| PR98-H09 | Bitácora y cuerpo del PR describen un estado que no está registrado | medio | abierto |
| PR98-H10 | El autor escribió dentro de la carpeta reservada a revisión | medio | arreglado-sin-verificar por la revisión |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Comandos: [`evidencia/comandos.md`](evidencia/comandos.md)

## Decisiones de Lautaro073 incorporadas

1. **Alcance:** se acepta ampliar T-311 a los archivos concretos de auth, merchant, courier onboarding, layout público, route-integrity y plan que son necesarios para enlazar P04 y persistir la versión mostrada.
2. **Responsable de datos:** Lautaro Emanuel Jimenez; domicilio de contacto: **Santa Cruz s/n, Aguilares, Tucumán, Argentina**; WhatsApp **+54 3865 575688**; email **lautarojimenez02@gmail.com**.
3. **Piloto:** duración prevista de **hasta 7 días desde el alta del comercio**. cadeApp puede finalizarlo antes por decisión operativa, informándolo al comercio; no hay cobro retroactivo y cualquier modalidad paga posterior requiere información y aceptación separadas.

## Qué queda por hacer

1. Resolver H01–H09 siguiendo el prompt de la ronda.
2. No tocar `docs/revision-pr/pr-98/**`: desde este commit la carpeta es exclusivamente de la revisión.
3. Luego de los arreglos, actualizar bitácora, push y pedir Ronda 2.

## Para el análisis posterior

No se propone una lección numerada nueva. Esta ronda refuerza dos patrones ya documentados: **AG-36** (quien implementa no firma su propia revisión) y **P08 / AG-61–AG-63** (un control debe matar la regresión concreta que dice cubrir). Ver [`lecciones.md`](lecciones.md).
