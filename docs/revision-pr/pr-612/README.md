# PR #612 — T-422 · Configuración de Maps y push del runner E2E

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/612 |
| Tarea | T-422 · Fase 4 |
| Autor | @Lautaro073 |
| Rama | `fix/T-422-runner-env` → `develop` |
| Base | `1105eaf42ae457b68cfd004ae182acebae68f3c7` |
| Head inspeccionado | `aa2357d3646e3e963941c979d8ddb452489d313c` |
| Tamaño original | 4 archivos · +92 / -10 |
| Estado de la ronda 1 | **SIN BLOQUEANTES** · 2 mejoras propuestas · D01 aceptada |

## Rondas

| Ronda | SHA inspeccionado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `aa2357d3646e3e963941c979d8ddb452489d313c` | H01 y H02 (mejoras); H03 (decisión A→B aceptada) | [revisiones/ronda-1.md](revisiones/ronda-1.md) |

## Estado por hallazgo

| ID | Tema | Severidad | Estado |
|---|---|---|---|
| PR612-H01 | Validar presencia de variables públicas Maps antes del build | medio · MEJORA | abierto |
| PR612-H02 | Reconciliar ficha, runbook y bitácora con Maps real y A→B | bajo · MEJORA | abierto |
| PR612-H03 | D01: A primera corrida, B solo si hay bloqueo de referer o consumo molesto | decisión | aceptado; documentación pendiente |

## Qué está comprobado

- El CI del SHA de código `aa2357d` terminó **success** (run 41982718298): 7/7 jobs; workflow tests 83/83 y db-tests con `Files=42, Tests=3396, Result: PASS`.
- La ejecución anterior del gate nuevo (run 41977303708, PR #611) terminó con **108 passing, 8 failing**. Esa evidencia no equivale a certificar el nuevo gate.
- Inspección: clave VAPID pública en build y servidor, privada únicamente en step con secretos; Maps API key y Map ID consumidos de `vars.*`.
- Siete mutaciones estructurales de revisión, realizadas en memoria, quedaron detectadas por controles independientes; no se corrieron tests E2E remotos ni se levantó Supabase/Docker.
- D01 resuelta personalmente por Lautaro073 el 2026-11-05: las dos variables ya existen en GitHub Environment `develop` y corresponden al Preview. Usar A primero; cambiar a B ante `RefererNotAllowedMapError` o consumo compartido problemático.

## Pendiente operacional

1. El agy agrega guarda fail-fast de configuración Maps con test que falla por mutación; documenta D01 en ficha, runbook y bitácora, y completa la plantilla del cuerpo de la PR.
2. Tras el merge que decida Lautaro073, ejecutar de forma natural el gate nuevo desde la rama por defecto y comprobar todos los E2E; **no** dar GREEN por supuesto antes.
3. El Ignored Build Step de Vercel pasa a construir solo `develop` **después** del primer gate real GREEN, nunca antes.
4. La revisión no aprobó ni mergeó nada. El commit de esta carpeta mueve el head, no cambia qué SHA fue revisado.

[Datos estructurados](hallazgos.jsonl) · [Evidencia y harness](evidencia/comandos.md) · [Lecciones](lecciones.md).
