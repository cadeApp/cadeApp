# PR #375 — T-358 · revisión independiente

| Campo | Estado |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/375 |
| Rama | feat/T-358-edicion-comercio-precarga → develop |
| Ronda 1 | b3ace3eb9acb2a3132c1d26bbb74863fdc1e2c91 |
| Ronda 2 | e8206d770718766fa0888df68252cb078b131bf0 |
| Fecha | 2026-10-16 |
| Resultado | CON BLOQUEANTES; 3 regresiones nuevas; H07 parcial, H08 abierto |
| Contratos | CC-027 (#380), CC-028 (#382) y ficha (#383) mergeados |

## Rondas
- [Ronda 1](revisiones/ronda-1.md) — 8 hallazgos.
- [Ronda 2](revisiones/ronda-2.md) — 6 hallazgos por inspección corregidos sin verificación independiente; 2 residuales y 3 nuevos.

## Estado por hallazgo
| ID | Sev. | Estado | Descripción |
|---|---|---|---|
| PR375-H01 | alto | arreglado-sin-verificar | El mapa muestra un marcador inventado cuando value es null |
| PR375-H02 | alto | arreglado-sin-verificar | La acción reescribe campos ausentes y pierde cambios concurrentes |
| PR375-H03 | alto | arreglado-sin-verificar | El nombre se actualiza en dos tablas sin transacción |
| PR375-H04 | alto | arreglado-sin-verificar | Coordenada null y coordenada omitida pasan la validación parcial |
| PR375-H05 | medio | arreglado-sin-verificar | Error de autenticación se confunde con usuario no autenticado |
| PR375-H06 | medio | arreglado-sin-verificar | No existe eliminación explícita del pin guardado |
| PR375-H07 | alto | parcial | Los controles no demuestran el pin real, RLS cruzado, concurrencia ni mutaciones propias |
| PR375-H08 | medio | abierto | Ficha y evidencia se declaran completas antes de cerrar revisión |
| PR375-R01 | alto | abierto | GPS fuera de cobertura borra pin guardado al editar teléfono |
| PR375-R02 | medio | abierto | Barrio guardado e inactivo se presenta como UUID en lugar de barrio |
| PR375-R03 | medio | abierto | Borrar pin deja error de validación falso por estado obsoleto |

Fuente [hallazgos.jsonl](hallazgos.jsonl) · [evidencia/comandos.md](evidencia/comandos.md) · [lecciones.md](lecciones.md).

## Siguiente paso
Arreglar R01-R03 sin ampliar scope, validar con mutaciones RED/GREEN independientes y E2E final, corregir H07/H08. Pedir ronda 3 antes de merge. El autor no edita docs/revision-pr/**.
