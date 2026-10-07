# Lecciones de la PR #293

**Fuente:** 1 hallazgo técnico + 4 decisiones aceptadas.

## PR293-H01

T-347 repite el patrón **P01 — contrato de framework no verificado**: una propiedad de GitHub Actions se convirtió en frontera de seguridad sin comprobar su semántica exacta.

No se propone un AG nuevo todavía. P01 ya representa correctamente la causa raíz.

La corrección decidida reutiliza una frontera ya probada en el repositorio: `repository_dispatch` para mantener el control plane en la rama por defecto y tratar el objetivo como dato no confiable.

## Decisiones

Las cuatro elecciones de arquitectura quedaron resueltas por Lautaro073:

- 0-B repository_dispatch;
- 1-A catálogo versionado;
- 2-A runtime local del runner;
- 3-A validación post-merge con reapertura si falla.

No quedan decisiones pendientes.
