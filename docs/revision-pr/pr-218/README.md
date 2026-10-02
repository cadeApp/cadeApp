# PR #218 — T-326 · Barrios de Aguilares y selector del onboarding de comercio

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/218 |
| **Tarea** | T-326 · Issue #190 |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-326-aguilares-zones-onboarding` → `develop` |
| **SHA funcional revisado** | `ea2b03a0d5cb5362e046bc6bdf4a0cff7e1169af` |
| **Estado** | Draft · CON BLOQUEANTES |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `ea2b03a0d5cb5362e046bc6bdf4a0cff7e1169af` | 4 hallazgos técnicos + 1 decisión P1 | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---:|---|
| PR218-H01 | Select controlado emite valor y luego vacío | alto | abierto · CC-018 #219 |
| PR218-H02 | publish_request fabrica 500 m sin ubicación efectiva | alto | abierto · T-330 #220 |
| PR218-H03 | Falta demostrar RED del pgTAP T-326 | medio | abierto |
| PR218-H04 | ON CONFLICT no sincroniza centroides documentados/null | medio | abierto |
| PR218-H05 | El PDF completo agrega 03 — 1º de Mayo fuera de la lista aprobada | alto | decisión P1 pendiente |

## Verificado como correcto

- Los 62 nombres actuales coinciden exactamente entre evidencia aprobada, migración, seed y pgTAP.
- Georreferenciación actual: 62 barrios = 51 puntos derivados + 11 null.
- Migración y seed coinciden exactamente con `barrios-centroides.json` en una base limpia.
- No hay coordenadas duplicadas ni derivadas fuera de los bounds del producto.
- El método documenta fuente, hash, 19 controles medidos / 17 usados, transformación afín y residuales.
- LOO RMS: 32,9 m; máximo: 62,7 m.
- La evidencia aclara correctamente que son puntos interiores representativos aproximados, no centroides oficiales ni centroides geométricos de polígonos.

## Dependencias creadas durante la revisión

- **CC-018 / #219:** corregir `src/ui/select.tsx`.
- **T-330 / #220:** impedir que `publish_request` fabrique 500 m.
- PR documental de coordinación: **#221**.

## Próximo paso

No continuar implementación funcional de T-326 hasta:
1. resolver/mergear #219;
2. resolver/mergear #220;
3. Lautaro073 decidir el tratamiento de `03 — 1º de Mayo`;
4. corregir H04;
5. demostrar H03;
6. sincronizar `develop`, completar UI, mutaciones y checks finales.

**No mergear PR #218 todavía.**
