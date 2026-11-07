# Lecciones — PR #655 (T-429)

**Fuente:** PR655-H01..H03. Sin AG nuevo: se aplican controles existentes (AG-37, AG-58, AG-60, AG-68, AG-75) y patrones P06/P08.

## Lección 1: enumerar estados intermedios, no solo filas finales
En streaming HTML, puede existir un `<template B:1>` **antes** de que llegue `<div S:1>`. La detección enfocada solo en segmentos `S:` carece de ese caso de la clase completa; AG-37 exige enumerarlo. Caso mínimo de prueba: B solo; B+S; S huérfano; nada; mezcla de varios. No inventar una nueva política mientras P06 lo describe.

## Lección 2: las esperas encadenadas deben compartir presupuesto
Recibir el mismo número `timeout` en tres APIs distintas **no** es respetar un tiempo total. El control independiente debe probar consumo cercano al deadline en una fase y espera posterior, no únicamente éxito cuando todos los pasos terminan instantáneamente. Es un caso de contrato incorrectamente implementado (P05), sin justificar una regla AG nueva por un solo caso.

## Lección 3: un test del detector no es un test del helper que lo integra
Los ocho tests validados solo invocan las funciones puras; quitar la llamada real de espera deja su superficie sin tocar. P08/AG-58 y AG-68 requieren probar el callsite y demostrar que la mutación de la integración produce RED. El autor no debe escribir ni certificar `docs/revision-pr/**` (AG-36).

## No generalizar
No corresponde exigir cambios de React/Next, mover aserciones negativas de privacidad ni abrir tareas de bundle como parte de esta PR: no se mostró afectación funcional de usuario y D01=B ya está decidida.

## Acción propuesta al agente
Agregar pruebas de B-only, presupuesto total y llamada efectiva a `waitForFunction`; asegurar mutaciones independientes RED→GREEN. Ningún cambio a `AGENTS.md` en esta ronda.

## Ronda 2 — comprobación de arreglos

- H01 se cerró con un predicado autocontenido que verifica `B:` aislado y combinaciones. Mutaciones M01 (aceptar B) y M02 (bloquear huérfanos) dan RED en el control independiente. Refuerza AG-37.
- H02 se cerró al repartir el timeout acumulado por deadline. Mutación M03 (restaurar timeout completo) y M06 (filtrar skeletons ocultos) producen defecto detectado. Refuerza P05.
- H03 ganó tests de integración sobre la condición serializada. Mutaciones independientes M04 (quitar espera) y M05 (quitar diagnóstico) son detectadas. Refuerza P08/AG-68.
- El primer `pnpm test` del autor tuvo dos fallos no identificados; el segundo y el CI oficial de `00279772` terminaron 3755/3755. No se atribuye causa sin nombres ni reproducciones; mejorar captura de nombres al siguiente fallo, fuera del alcance de este PR.
- **Sin lecciones AG nuevas ni decisiones nuevas.** No modificar `AGENTS.md`.
