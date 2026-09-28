# Lecciones — PR #120 / T-202

## Candidatos observados

### Un harness no puede agregar la integración que dice verificar
**Origen:** PR120-H01.  
Si el test ejecuta el artefacto productivo y después le inyecta el listener/handler esperado, deja de probar el artefacto. Para service workers, workers, cron o entry points generados, el test de integración debe ejecutar exactamente el recurso que se sirve/despliega.

### “Permiso concedido” y “suscripción push operativa” son estados distintos
**Origen:** PR120-H03/H04.  
Web Push tiene al menos tres pasos observables: permiso, suscripción nativa y persistencia server-side. La UI no puede colapsarlos en un único `granted`.

### Una prueba negativa necesita una entrada que contenga lo prohibido
**Origen:** PR120-H11.  
Para demostrar que PII no se propaga, el fixture debe incluir PII/extra y la prueba debe fallar si el código empieza a copiarlo. Un fixture ya saneado no ejercita la prohibición.

No se asigna número AG nuevo en esta ronda hasta contrastar estos patrones con el histórico al cerrar los arreglos.
