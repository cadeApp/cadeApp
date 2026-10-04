# Lecciones — PR #248 / T-336

## Ronda 1

T-336 vuelve a mostrar dos patrones ya conocidos; no hace falta una AG nueva todavía.

### 1. Unificar una función no sirve si los consumidores la esquivan

`getSessionHomePath` quedó correcto para admin, pero varias ramas conservaron `getRoleDefaultPath('admin')` para no romper un test histórico. El contrato nuevo quedó bien en el productor y viejo en consumidores específicos.

Esto repite la lección de T-334 / PR #240: cuando una decisión cruza consumidores, hay que probar la clase completa y reconciliar tests viejos que ahora contradicen el contrato.

### 2. Un scanner “estricto” puede seguir siendo parcial

H02 repite P08 de PR #87:
- reconocer una forma sintáctica no equivale a cubrir productores de navegación;
- allowlistear un archivo completo es más amplio que allowlistear una ocurrencia;
- además una regex global reutilizada con `.test` introduce estado accidental.

### 3. Mutación real ≠ mutante simulado dentro del test

La bitácora con una mutación temporal real es evidencia útil. Un test que construye manualmente el código roto y comprueba que está roto no protege producción.

## Sin AG nueva

Las reglas ya existentes cubren estos casos:
- enumeración completa;
- controles discriminantes;
- no tests tautológicos;
- evidencia real en Preview.


## Ronda 2

H01 y H03 cierran de forma robusta.

H02 deja una lección más precisa sobre P08: **enumerar más sintaxis directa no equivale a seguir el productor del destino**. Es la misma distinción que apareció en PR #87. Un control de navegación root debe seguir, al menos, las variables/helpers locales que el propio archivo ya sabe resolver para rutas inexistentes.

No se propone AG nueva: refuerza AG-61/P08.

H04 confirma que combinar evidencia manual con un probe independiente del Preview y CI exact-head permite cerrar la navegación real sin inventar estados.


## Ronda 3 final

H02 cierra al cambiar de una lista de formas directas a un control que **resuelve el productor simple del destino**.

La lección es concreta: para controles de navegación, cubrir `router.push('/')` no basta si `router.push(target)` puede recibir un literal root definido localmente. El alcance razonable no requiere análisis de flujo interarchivo, pero sí las variables/helpers locales simples que el propio módulo puede resolver de manera determinista.

No se propone AG nueva; queda cubierto por P08 / AG-61 y por la exigencia de mutaciones discriminantes.


## Ronda 4 extraordinaria

La validación personal posterior encontró una diferencia que los tests del guard no podían ver: **calcular correctamente el destino no garantiza que una navegación cliente vuelva a ejecutar la frontera que calcula ese destino**.

Cuando una regla depende de middleware/sesión y el origen es un Link cliente, hace falta al menos una regresión browser-level que preserve el mismo contexto y cookies entre login → 404 → retorno.

No se concluye todavía si la causa es router cache o pérdida de cookie; el diagnóstico debe distinguirlas antes de tocar auth.


## Ronda 5

El producto puede estar bien arreglado y, aun así, la regresión quedar sin protección si el test contiene pasos de diagnóstico que corrigen el fallo antes de la aserción.

En E2E, una rama tipo «si falló, hacé la navegación que sabemos que funciona y después comprobá el destino» convierte un control real en uno no discriminante.

La regla práctica es:
- diagnóstico manual/pre-fix puede incluir controles A/B;
- el test permanente debe reproducir exactamente la acción del usuario y fallar en el primer desvío.

No se propone AG nueva: es P04/P08 ya existente.


## Ronda 6

La diferencia entre «la función middleware está testeada» y «Next realmente descubrió el entrypoint middleware» es crítica.

Con `src/app`, la ubicación física del entrypoint es parte del contrato ejecutable. Los unit tests de `evaluateRouteGuard` y `updateSession` pueden estar completamente verdes mientras el framework nunca llama esa lógica.

Nuevo aprendizaje concreto:
- revisar el output del build para entrypoints especiales;
- proteger la convención de ubicación;
- usar E2E real para fronteras framework/auth.

No se propone AG nueva por ahora: el caso puede quedar como lección P15 si el control estructural se incorpora en T-336.
