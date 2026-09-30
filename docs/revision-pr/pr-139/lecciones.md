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
