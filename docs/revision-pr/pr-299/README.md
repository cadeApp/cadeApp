# PR #299 — T-339 · Precio de envío opcional y toma directa

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/299 |
| Tarea | T-339, fase 3, CC-021 |
| Autor | @asako669 |
| Rama | `feat/T-339-precio-fijo` → `develop` |
| Base observada | `a773c05cc488a1fc60bfb36512cdca35d12d1271` |
| HEAD inspeccionado | `6fbde29f48cc502ff497d18c4488fcd442246bf6` |
| Tamaño antes de revisión | 35 archivos, +3472/-111 líneas |
| Decisión de alcance | Lautaro073 aprobó opción A: `src/ui/ui-system.test.tsx` permitido para ajustar 27→29 códigos |
| Estado | CON BLOQUEANTES; NO APROBAR / NO MERGEAR |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `6fbde29f48cc502ff497d18c4488fcd442246bf6` | 9 bloqueantes, 1 mejora | [ronda-1.md](revisiones/ronda-1.md) |

## Hallazgos

| ID | Gravedad | Resumen | Estado |
|---|---|---|---|
| PR299-H01 | crítico | variable SQL de consentimiento inexistente: migración falla | abierto |
| PR299-H02 | alto | orden de locks de accept_offer expone deadlock | abierto |
| PR299-H03 | alto | take_request da idempotencia a ofertas sin precio fijo | abierto |
| PR299-H04 | alto | pgTAP plan 28 contra 26 aserciones y bordes faltantes | abierto |
| PR299-H05 | alto | DoD de concurrencia y consentimiento no ejercido | abierto |
| PR299-H06 | alto | cobertura de ramas del fake bajo umbral: CI unit rojo | abierto |
| PR299-H07 | medio | prueba de rate limit del fake no agota el cupo | abierto |
| PR299-H08 | alto | E2E siembra publicados; no ejercita alta real desde formulario | abierto |
| PR299-H09 | medio | `any` prohibido en test de contrato | abierto |
| PR299-H10 | bajo | sugerir piso dinámico en formulario | mejora |

## Evidencia

- [Informe detallado](revisiones/ronda-1.md).
- [Datos estructurados](hallazgos.jsonl).
- [Comandos y batería independiente](evidencia/comandos.md).
- [Lecciones](lecciones.md).

## Alcance de lo verificado

Se inspeccionaron diffs, SQL, contratos, fake, formulario, E2E, bitácora, comentarios y logs de CI del SHA original. Solo `db-tests` y `unit` tuvieron fallo confirmado por CI; los peligros de deadlock y semántica se registran **por inspección**, NO como reproducción PostgreSQL. No se levantó Docker/Supabase ni se ejecutaron pruebas de integración locales. Los contadores y los checks estructurales se calcularon independientemente sobre contenido exacto del commit indicado. Este commit de documentación moverá el HEAD: el SHA verificado por revisión sigue siendo el anterior, no el commit del informe.

