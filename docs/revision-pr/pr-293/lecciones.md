# Lecciones de la PR #293

**Fuente:** 1 hallazgo técnico cerrado + 4 decisiones aceptadas.

## PR293-H01

T-347 repitió el patrón **P01 — contrato de framework no verificado**: una propiedad de GitHub Actions se convirtió en frontera de seguridad sin comprobar su semántica exacta.

Ronda 2 verificó la corrección: `repository_dispatch` mantiene el control plane en la rama por defecto y el target se trata como dato no confiable.

No se propone un AG nuevo: P01 ya representa la causa raíz y la ficha quedó corregida.

## Decisiones

Las cuatro elecciones de arquitectura quedaron incorporadas en el contrato:

- 0-B repository_dispatch;
- 1-A catálogo versionado;
- 2-A runtime local del runner;
- 3-A validación post-merge con reapertura si falla.

No quedan decisiones pendientes.
