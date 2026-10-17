# Lecciones — PR #402 / T-369

- **H01 / P08:** una key de idempotencia en memoria de un componente garantiza reintentos dentro del montaje, no recuperación de una operación de pago/crédito con respuesta incierta tras remount/refresh. Probar persistencia de intento pendiente y nuevo intento independiente. Nunca equiparar mismo payload con misma compra para siempre.
- **H02 / P08:** una rama de error de una acción alternativa requiere estado de error propio además de toast. El test del camino exitoso y de otro botón no cubre el error de la alternativa.
- **H03 / P08:** .limit(100) sin cursor no constituye paginación. Probar al menos 151 registros y sort duplicado, tanto en catálogo como en selector de planes.
- **H04 / P10:** anotar «decisión de Lautaro073» en ficha desde una PR no prueba aprobación. La decisión auténtica D01-B reemplaza service role por RPC admin AAL2 con permisos mínimos y nuevas pruebas SQL, sin editar migración mergeada.

Se revisó estructura/CI pero no se ejecutaron tests ni mutaciones localmente. Por tanto se deja cada hallazgo `abierto` y se espera RED→GREEN verificable antes de certificarlo. No asignar numeración global AG-XX sin buscar el máximo en ramas remotas; referencias canónicas PR402-Hxx.