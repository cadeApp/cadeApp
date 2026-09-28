# Revisión independiente — PR #120 · T-202

- **PR:** #120 — [T-202] Cliente de push
- **Autor:** KiraK72
- **Base:** `develop@c8be7ab2dce769fd349346dbc26457d0ee991a5e`
- **HEAD revisado:** `6eaea38b7de421ad6101171d6cdbd402dc393704`
- **Ronda:** 1
- **Fecha:** 2026-09-28
- **Estado:** BLOQUEADA — requiere correcciones y nueva ronda
- **CI del HEAD:** verde (lint, audit, typecheck, unit, build, db-tests y bundle-budget)

## Decisiones humanas resueltas

- **D01 = 1-A (Lautaro073):** T-202 queda autorizada a incorporar `public/sw.js` para integrar los handlers de push en el service worker productivo de T-201.
- **D02 = 2-A (Lautaro073):** T-202 queda autorizada a incorporar `src/features/notifications/index.ts` para exponer/montar T02 respetando la frontera de entry points.

Estas decisiones deben quedar reflejadas por el autor en `docs/tasks/T-202.md` antes de usar esos archivos.

## Resultado

Se registran **11 bloqueantes** y **2 mejoras**. El principal problema es que CI está verde pero dos controles centrales no prueban el runtime productivo: el harness registra los handlers manualmente y la “verificación responsive” solo cambia `window.innerWidth` en jsdom.
