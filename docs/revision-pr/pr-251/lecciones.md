# Lecciones de la PR #251 (T-313)

## Ronda 1

No agrego un AG nuevo en esta ronda.

- pr-56/AG-37 aplica directamente a PR251-H01: si el DoD habla de una clase completa, hay que enumerar la clase;
  una muestra hardcodeada no la demuestra.
- P08-control-no-cubre-lo-que-dice reaparece en PR251-H02 y PR251-H04: el cleanup no reporta todos sus fallos y
  la evidencia E2E todavía no llega al comportamiento que pretende verificar.
- El cuerpo de una PR no es evidencia: el checkbox de typecheck/lint/test aparece marcado mientras la bitácora
  dice que lint y test no se ejecutaron. La skill ya exige comprobar salida real, así que no hace falta nueva regla.
