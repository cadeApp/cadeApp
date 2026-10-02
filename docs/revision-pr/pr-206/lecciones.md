# Lecciones — PR #206

## Ronda 1

No se abre numeración AG nueva todavía.

- Un cambio de topología de ambientes no termina en el workflow: también debe actualizar las reglas que autorizan a los agentes a usar cada ambiente. Si el código dice “Develop separado” y AGENTS dice “Develop usa Staging”, la siguiente tarea recibe dos contratos incompatibles.
- Un GitHub Environment con service role y contraseña de base necesita restricción de ramas como parte del control, no como recomendación documental. Guardar el workflow confiable en develop no impide que otra workflow definition solicite el mismo Environment si la configuración externa no lo limita.
- La identidad de tarea también es un control: mover infraestructura de T-327 a la bitácora de T-303 rompe trazabilidad aunque el código sea correcto.
- La limitación de `concurrency` de GitHub debe escribirse como capacidad real. P1 aceptó 5-A: una cola nativa limitada con re-run es suficiente; no se debe prometer FIFO ilimitado.


## Ronda 2

- La revisión debe separar **código fail-closed correcto** de **configuración externa realmente presente**. Un workflow puede validar perfectamente una variable y aun no estar listo para merge si esa variable todavía no existe.
- El Preview real es mejor evidencia que el comentario del bot: en esta ronda el health cambió de 302 a 200 y permitió cerrar la decisión 1-A sin especular sobre la UI de Vercel.
- Cuando P1 resuelve una contradicción de la issue durante la ronda, la fuente canónica debe actualizarse también; dejar solo un comentario de decisión obliga a futuros agentes a reconciliar dos textos.


## Ronda 3

- Un secreto de infraestructura puede quedar **aceptado con residual verificable** cuando inspeccionarlo manualmente violaría las propias reglas de seguridad y existe un gate post-merge fail-closed que demuestra exactamente el permiso necesario.
- “PR apta para merge” y “tarea terminada” son estados distintos: T-327 puede entrar a develop sin bloqueantes pre-merge y seguir abierta hasta observar `migrate-develop` + un `e2e-preview` real GREEN.
- La evidencia visual de configuración externa aportada por P1 sí sirve para cerrar un hallazgo de Environment cuando el conector del reviewer no tiene permisos administrativos para leer esa configuración.
