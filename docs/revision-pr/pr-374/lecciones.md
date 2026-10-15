# Lecciones PR #374 / CC-025 fase A

- **P08 / pr-63/AG-68:** `ON CONFLICT DO UPDATE` con un ID/path que no colisiona NO verifica la rama de UPDATE: usar fixtures que comprueben el efecto real después.
- **P08 / pr-56/AG-37:** `psql` conectado como postgres y `SET LOCAL ROLE` sin assertion de principal permite interpretar mal un test de permisos. Afirmar current_user y auth.uid dentro de la misma transacción.
- **P15:** un CI que pasó en SHA anterior no certifica SHA nuevo. Si build externo de fuentes falla, no acusar regresión por migración sin evidencia; sí bloquear merge mientras gate falla.
- **Proceso:** nunca incluir `Closes #363` en una PR A parcial. El revisor lo corrigió en metadata y registró alcance.

No se asignó AG nuevo sin revisar todas las ramas remotas para evitar colisiones de numeración.
