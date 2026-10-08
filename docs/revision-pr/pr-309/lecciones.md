# Lecciones — PR #309

- RED de axe confirmado no implica GREEN demostrado: si no existe Preview exact-head por cuota, la evidencia sigue incompleta aunque unit/typecheck sean verdes.
- Los RED adversariales exigidos por ficha necesitan mutar **UI**, sin tocar expectations, y revertirse con logs/SHA comprobables.
- El diff de esta rama temporal hereda T-309 por diseño; contrastar también `3ff8984...HEAD` para identificar los tres archivos propios de T-351.
- Esta PR jamás se mergea: solo sustenta la revisión de la PR productiva #310.

No se propone AG nuevo a partir de un único caso.
