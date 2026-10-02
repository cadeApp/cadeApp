# Revisión PR #208 — CC-016

- **PR:** #208
- **Rama:** `cc/CC-016-merchant-courier-projection`
- **SHA funcional revisado:** `37c5fd892e535ea4cf68b74c4f65e3f650b6c3ff`
- **develop actual al cierre de ronda:** `cb4111273da663f7591aec370a44767c4e677b82`
- **merge-base:** `6577d9e427c5efc0a79a2c374f0f74d847732f4d`
- **Ronda:** 1
- **Resultado:** **CON BLOQUEANTES (1)**
- **CI del SHA funcional:** GREEN, pero generado contra la base vieja `6577d9e427c5efc0a79a2c374f0f74d847732f4d`; no valida la integración con el develop actual.

La implementación de CC-016 está bien orientada por inspección: la proyección se resuelve en una RPC `SECURITY DEFINER` con autorización dentro de Postgres, salida mínima y estricta, sin ampliar RLS, y los consumidores fallan cerrado en vez de inventar `docLevel = 0`.

El único bloqueante de esta ronda es de integración: develop avanzó 16 commits mientras la rama quedó en su base original. Debe mergearse `origin/develop` y repetirse la evidencia sobre el nuevo HEAD antes de poder cerrar la revisión.
