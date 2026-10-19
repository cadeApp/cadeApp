# Lecciones de la PR #431

Es una PR exclusivamente documental. El contraste de los specs existentes y los logs confirmó que la ficha aborda el modo de falla correcto. No se detectaron defectos de código en el diff porque no hay código nuevo.

La mejora preventiva se incorporó directamente a la ficha: al combinar una precondición fail-closed con hooks que modifican estado global, es obligatorio distinguir entre **estado sucio al entrar** (detectar, no reparar) y **estado que la propia prueba pudo cambiar** (restaurar y verificar). No se asigna un nuevo número AG con una sola observación preventiva, ni se modifica AGENTS.md.

La siguiente PR debe probar estas propiedades con un timeout de Playwright y un almacenamiento inyectado en memoria, además del E2E real en Develop. Nunca confundir un check de ficha verde con evidencia de que el mecanismo de restauración ya funciona.
