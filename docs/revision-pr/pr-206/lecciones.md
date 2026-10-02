# Lecciones — PR #206

## Ronda 1

No se abre numeración AG nueva todavía.

- Un cambio de topología de ambientes no termina en el workflow: también debe actualizar las reglas que autorizan a los agentes a usar cada ambiente. Si el código dice “Develop separado” y AGENTS dice “Develop usa Staging”, la siguiente tarea recibe dos contratos incompatibles.
- Un GitHub Environment con service role y contraseña de base necesita restricción de ramas como parte del control, no como recomendación documental. Guardar el workflow confiable en develop no impide que otra workflow definition solicite el mismo Environment si la configuración externa no lo limita.
- La identidad de tarea también es un control: mover infraestructura de T-327 a la bitácora de T-303 rompe trazabilidad aunque el código sea correcto.
- La limitación de `concurrency` de GitHub debe escribirse como capacidad real. P1 aceptó 5-A: una cola nativa limitada con re-run es suficiente; no se debe prometer FIFO ilimitado.
