# Lecciones — PR #160

## Ronda 1

Se mantienen los patrones ya catalogados P08, P04, P06, P03 y P19.

## Ronda 2

Se reforzaron P08/P16/P03/P19/P10: un fixture real puede invalidar el escenario, el cleanup debe incluir writes hechos por UI y una corrección sobre base vieja exige revalidación.

## Ronda 3

No se abre AG nuevo. La ronda agrega evidencia a patrones existentes:

- **P08-control-no-cubre-lo-que-dice:** un E2E puede ejecutar una acción real y aun dar falso positivo si el oráculo no identifica la entidad recién creada o solo exige que dos resultados sean diferentes.
- **P01-contrato-de-framework-no-verificado:** cambiar de identidad dentro del mismo browser context sin comprobar el guard de auth vuelve inejecutable el flujo.
- **P06-enumeracion-incompleta:** el inventario de cleanup debe incluir efectos secundarios de RPC como `rate_limits` y `audit_log`, no solo entidades principales.
- **P03/P19:** una simulación del estado final no equivale a demostrar que el E2E detecta una implementación realmente rota.

### Para Ronda 4

Exigir antes de aprobación:
1. publicación cash acotada a su propia fila;
2. orden exacto por ambos criterios;
3. merchant/courier en sesiones separadas;
4. cleanup de tablas auxiliares;
5. evidencia RED reproducible;
6. salida de `pnpm test`, db-tests CI y Playwright staging.
