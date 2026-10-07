# Lecciones de la PR #295 para `AGENTS.md` y las reglas

**Fuente:** 6 hallazgos de Ronda 1. Datos crudos en [`hallazgos.jsonl`](hallazgos.jsonl).

## Patrón dominante

Esta ronda vuelve a mostrar `P08-control-no-cubre-lo-que-dice`: la fase RED enumera correctamente los objetivos de T-338, pero varios controles miden helpers o estados finales en vez de la integración y el contrato observable que el DoD nombra.

No se propone un número AG nuevo: los casos ya están cubiertos por lecciones existentes.

## Refuerzos

### AG-37 · Enumerar la clase completa antes de cerrar la ronda

H02 obliga a tratar Home, Login, Register y Legal como una sola clase de integraciones standalone. Probar un helper una vez no sustituye revisar cada consumidor que el DoD enumera.

### AG-63 · La mutación debe proteger el control

H04 y H05 necesitan una mutación discriminante escrita/repetible:

- si `is-ios.ts` vuelve a duplicar la lógica en vez de llamar `isStandalone()`, el test debe ponerse rojo;
- si la respuesta offline vuelve a texto plano, el test debe ponerse rojo.

### AG-68 / AG-70 · El nombre del test o de la bitácora no es evidencia

H03 es un caso directo: la bitácora nombra páginas que el test no importa. El rojo se registra desde la salida real y el wiring se demuestra con una prueba que alcance al consumidor.

## Qué cambiar, en orden de impacto

1. Corregir H02: pruebas reales de wiring de las cuatro páginas.
2. Corregir H03: nueva entrada de bitácora con evidencia ejecutada, sin reescribir la anterior.
3. Cerrar H04 y H05 con mutaciones discriminantes.
4. Reforzar H06 para observar la transición, no solo el destino final.
5. Recién entonces completar la implementación productiva H01.

## Advertencias

- Esta es una PR Draft en fase RED inicial; H01 no implica que el agente haya declarado falsamente la tarea terminada. La bitácora reconoce que falta implementación.
- Los hallazgos H02–H06 son útiles precisamente ahora: corregirlos antes de GREEN evita aceptar una implementación que satisfaga proxies.
- No se inspeccionó CI en Ronda 1 porque ya había bloqueantes estáticos.
