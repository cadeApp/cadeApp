# PR #375 — T-358 · Edición de datos del comercio

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/375 |
| Autor | @Lautaro073 |
| Rama | `feat/T-358-edicion-comercio-precarga` → `develop` |
| Ronda 1, SHA de la revisión | `b3ace3eb9acb2a3132c1d26bbb74863fdc1e2c91` |
| Base de la PR | `2d2c011c3261981f218a7559e1b32581ffe9b984` |
| Fecha | 2026-10-15 |
| Estado | **CON BLOQUEANTES (5 altos, 3 medios; 8 abiertos)** |
| Decisiones confirmadas | 1-A → CC #378, 2-A → CC #379 |
| Issue T-358 | #345 · etiqueta `bloqueada` |

## Rondas

| Ronda | SHA | Informe |
|---|---|---|
| 1 | `b3ace3eb9acb2a3132c1d26bbb74863fdc1e2c91` | [revisiones/ronda-1.md](revisiones/ronda-1.md) |

## Hallazgos

| ID | Severidad | Estado | Descripción |
|---|---|---|---|
| PR375-H01 | alto | abierto | El mapa muestra un marcador inventado cuando value es null |
| PR375-H02 | alto | abierto | La acción reescribe campos ausentes y pierde cambios concurrentes |
| PR375-H03 | alto | abierto | El nombre se actualiza en dos tablas sin transacción |
| PR375-H04 | alto | abierto | Coordenada null y coordenada omitida pasan la validación parcial |
| PR375-H05 | medio | abierto | Error de autenticación se confunde con usuario no autenticado |
| PR375-H06 | medio | abierto | No existe eliminación explícita del pin guardado |
| PR375-H07 | alto | abierto | Los controles no demuestran el pin real, RLS cruzado, concurrencia ni mutaciones propias |
| PR375-H08 | medio | abierto | Ficha y evidencia se declaran completas antes de cerrar revisión |

Datos: [hallazgos.jsonl](hallazgos.jsonl). Comandos y límites: [evidencia/comandos.md](evidencia/comandos.md). Lecciones: [lecciones.md](lecciones.md).

## Qué sigue

1. En PRs separados, desarrollar y mergear CC #378 (mapa) y CC #379 (RPC transaccional); P1/P2 coordinan los contratos, con aprobación de producto de Lautaro073 ya registrada.
2. Reconciliar `docs/tasks/T-358.md` mediante PR documental, sin habilitar `src/ui/**` ni `supabase/**` dentro de la tarea original mientras no se apruebe la ficha.
3. Reabrir T-358 y corregir pruebas e implementación sin que el autor toque `docs/revision-pr/**`.
4. Revalidación independiente R2 sobre HEAD nuevo. **No mergear T-358 aún**.

**Límite de esta ronda:** GitHub Connector permitió revisar fuentes/CI; no hubo clon de git ni ejecución de las mutaciones propias; no se afirma `arreglado-verificado`.
