# Lecciones de la PR #139

**Fuente:** 9 hallazgos de ronda 1.

## No se agrega numeración AG nueva

- **pr-63/AG-71:** el target puede cambiar mientras una PR está abierta. Acá la rama quedó 13 commits detrás y la ficha T-317 cambió de forma material.
- **pr-56/AG-37:** enumerar la clase completa permitió encontrar H08: listFactors y unenroll eran las llamadas remotas previas a enroll que no tenían manejo de error.
- **P08-control-no-cubre-lo-que-dice:** H03, H04, H06, H07 y H09 son variantes de controles cuyo nombre promete más que lo observado.
- **pr-68/AG-75:** las reproducciones/mutaciones de esta ronda son propias de la revisión; no se toma la batería del autor como verificación independiente.

## Orden recomendado

1. Sincronizar develop sin tocar la ficha.
2. Cerrar fugas/fronteras operativas: .env.local, totp.secret, TTY y fail-open de factores.
3. Hacer observables por test la factory de Supabase, el XML escrito y los argumentos de signOut.
4. Añadir el caso excepcional post-QR y sus mutaciones RED.

## Advertencias

H03–H07 nacen en parte de una evolución de la ficha posterior al fork de la rama; no implica que el agente ignorara requisitos que ya tuviera delante al implementar. H08 sí es independiente de ese cambio.

## Ronda 2

- **H10:** un `finally` con dos obligaciones de cleanup también necesita enumeración completa: un fallo del primer cleanup no puede impedir el segundo.
- **H11:** refuerza `P08`: probar Enter/Ctrl+C no equivale a probar “restaura siempre”; un stream también termina por `error`/`end`.
- **H12:** refuerza `P08`: validar el envelope (`data:image/svg+xml`) no verifica el contenido que el control promete (`<svg…>`).
- No se agrega numeración AG nueva; los tres casos caben en patrones existentes.

## Ronda 3

- H10–H12 quedaron cerrados con reproducción independiente y mutación inversa de cada propiedad.
- La regla de `verificado_en_sha` fue relevante: aunque H01–H09 ya estaban cerrados, el archivo volvió a cambiar y hubo que revalidarlos sobre el nuevo SHA antes de afirmar cierre total.
- `approval-policy` distingue correctamente revisión técnica de la evidencia operativa: el único rojo restante exige el informe en el cuerpo de la PR; la prueba real de staging sigue siendo una obligación manual separada.
- No se agrega numeración AG nueva.

## Ronda 4

- Un merge de `develop` no obliga por sí solo a reabrir hallazgos funcionales: primero hay que comprobar si cambió alguno de los blobs que sostenían la verificación. En R4 los tres artefactos funcionales quedaron byte-identical a R3.
- La divergencia con `develop` debe evaluarse por contenido: los 12 commits faltantes son exclusivamente documentación de T-318/PR143 y no cambian T-317 ni CI.
- Un intento manual fallido antes de completar el flujo no sustituye la evidencia operativa del DoD. La PR puede estar técnicamente limpia y seguir sin estar lista para merge.
- No se agrega numeración AG nueva.

## Rondas 5–6

- H13 es un caso directo de P01: el mock representaba una forma plausible del proveedor, no la forma real de la versión instalada.
- Para fronteras de serialización externas, un fixture realista del proveedor evita que una suite completamente verde valide un contrato inventado.
- La prueba manual de staging encontró un defecto que 30 tests unitarios no podían ver; después del arreglo, el caso real quedó incorporado como fixture y la suite subió a 34 tests.
- No se agrega una regla nueva: P01 ya cubre el patrón.

## Ronda 7

- Un guard puede estar correcto y aun así el flujo real estar roto si el login nunca navega hacia la ruta protegida que activa ese guard.
- Un `INTERNAL_ERROR` que agrupa estados operativos distintos impide diagnosticar staging y puede convertir un estado recuperable (“sin factor verificado”) en un supuesto fallo de infraestructura.
- La evidencia end-to-end sigue encontrando huecos que las pruebas unitarias por componente no conectaban.

## Ronda 8

- H14 se cerró sin romper un contrato anterior: cuando una función de “default por rol” tiene consumidores históricos, el flujo nuevo puede derivarse del guard canónico en vez de alterar globalmente ese default.
- H15 refuerza P06: dos fallos que terminan en el mismo DomainError pueden ser semánticamente distintos; enumerar cada salida remota permite conservar un estado recuperable sin disfrazarlo de infraestructura.
- Los tests del formulario son importantes porque verifican la conexión entre Server Action/resolver y navegación real, no solo helpers aislados.
- El merge sintético de GitHub permite validar compatibilidad con un develop adelantado sin fingir que la rama está sincronizada en historia.

## Ronda 9

- La evidencia E2E debe distinguir “el control de acceso dejó pasar” de “la página renderizó todos sus datos”: un error de query posterior puede confirmar el primero y revelar un defecto independiente.
- No conviene absorber indefinidamente fallos encontrados en staging dentro de la PR que habilitó el entorno. Cuando el fallo pertenece a código previo (T-122/T-123), se registra como follow-up separado.
- Los tests mockeados de queries Supabase no sustituyen una ejecución real de PostgREST para validar joins/embeds y datos seed de un remoto.
