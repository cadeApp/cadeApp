# Lecciones — PR #180 / T-307

## Ronda 1

No se agrega número AG nuevo.

- **H01 / P08:** un E2E de Realtime no puede sustituir la aplicación por dos `fetch()` manuales al mismo mock. La propiedad observable tiene que ser la UI actualizada por el canal real.
- **H02 / P08:** “hubo alguna request” no equivale a “la query se refetcheó”. Si el propio test genera una request que satisface el detector, el control certifica su estímulo y no el comportamiento del producto.
- Para reconexión, registrar la URL exacta de la query activa y tomar un contador baseline antes de `setOffline(false)`; ninguna request manual del spec debe poder satisfacer la aserción.
- **H04 / AG-36:** la autorrevisión del agy se conserva para contraste, pero no puede ocupar la ronda de revisión independiente ni marcarse como verificación.

## Ronda 2

No se agrega número AG nuevo.

- **H05 / P08:** esperar que “todavía no se vea” un dato no prueba que la carga inicial haya terminado. Cuando la propiedad a demostrar es una actualización posterior, el E2E debe esperar explícitamente el response inicial, fijar un baseline y exigir una segunda observación después del estímulo.
- Un timeout menor al polling evita un falso positivo por polling, pero no evita un falso positivo por una request inicial todavía en vuelo.
- **Preview READY no equivale a E2E ejecutado.** La evidencia válida debe demostrar que el spec concreto de la tarea corrió contra el SHA concreto.
- Un gate trusted que corre desde la rama por defecto no puede ser ampliado por la misma PR bajo prueba y usado como evidencia de sí mismo.

## Ronda 3

No se agrega número AG nuevo.

- **H06:** `page.addInitScript` prepara futuros documentos/navegaciones; una expectativa que depende de ese override debe ejecutarse después de una navegación donde el script haya corrido.
- Un status `e2e-preview` rojo puede ser ajeno a la PR bajo revisión: hay que abrir el job y clasificar el fallo por spec/flujo, no inferirlo desde el status agregado.
- Un gate que no enumera el spec de la tarea no certifica esa tarea, aunque el Preview, Supabase Develop y health check estén funcionando.
- Declarar una mutación RED en bitácora no reemplaza la salida reproducible del test; mientras no exista evidencia ejecutable se mantiene `arreglado-sin-verificar`.

## Ronda 4

No se agrega número AG nuevo.

- Un E2E debe usar un oráculo que pertenezca al invariante de la tarea. Si la aserción depende de una proyección rota por otro issue conocido, el test queda acoplado y puede dar rojo por una causa ajena.
- Para probar que una oferta concreta llegó por Realtime, un marcador único dentro de la propia oferta (por ejemplo `message`) es mejor oráculo que el nombre del courier cuando ese nombre depende de otra política/RLS.
- Si `develop` avanzó solo en infraestructura trusted y no hay conflictos funcionales, el revisor puede hacer el merge mínimo sin devolver ese trabajo mecánico al agy.


## Ronda 5

- Cuando un E2E trusted queda RED por la propiedad exacta que debía proteger, eso es evidencia de que el control dejó de ser un falso positivo; no corresponde aflojar el test para volverlo verde.
- Resolver el runner no resuelve el producto: separar bloqueo de infraestructura de bloqueo funcional evita cerrar una tarea por el motivo equivocado.

## Ronda 6

- Los IDs de tarea son claves de coordinación: reutilizar `T-331` para dos trabajos distintos puede hacer que automatizaciones cierren el issue equivocado.
- Un issue marcado `hecha` no es evidencia de implementación. Siempre cruzar el cierre con el diff de producto y con el E2E que detectó el defecto.
- La repetición del mismo RED bajo un runner distinto (lista explícita vs autodiscovery) aumenta la confianza en que el problema está en producto y no en la selección del spec.


## Ronda 7

- Un hook Realtime correcto no alcanza si la base no publica la tabla. La publicación de Postgres Changes forma parte del contrato operativo y debe quedar versionada junto con las migraciones.
- Los mocks de `channel.subscribe` prueban la lógica del cliente, pero no pueden demostrar que Supabase emita eventos reales para una tabla.
- Un resultado parcial post-fix es informativo: reconnect pasó de RED a GREEN tras T-333, mientras Realtime permaneció RED. Eso separa causas y evita reabrir una corrección ya cerrada.
- No asumir que una configuración manual de Dashboard existe o es igual entre entornos; el diagnóstico debe consultar `pg_publication_tables` y el fix debe ser declarativo.


## Ronda 8

- Verificar que una tabla figure en `pg_publication_tables` es necesario, pero no prueba la entrega end-to-end de Postgres Changes.
- Un fix de infraestructura puede cerrar una causa concreta y revelar otra sin que la primera corrección haya sido incorrecta; separar H09 de H10 evita reescribir la historia.
- Un segundo GET disparado al llegar `SUBSCRIBED` demuestra readiness/catch-up del canal, pero no demuestra que un cambio posterior atraviese publicación, RLS, Realtime y callback.
- Cuando el E2E real sigue RED después de una migración, no ampliar RLS, usar `REPLICA IDENTITY FULL` ni relajar el test “por si acaso”: primero aislar en qué frontera desaparece el evento.
