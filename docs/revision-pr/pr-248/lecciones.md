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
