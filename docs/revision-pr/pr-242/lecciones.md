# Lecciones — PR #242 / T-325 hotfix

## Ronda 3

La ampliación de `/courier/profile` fue confirmada como autorizada por Lautaro073; no se trata como desvío.

El nuevo problema no es la autorización sino **la integración temporal entre ramas**:

- T-325 amplió perfil sobre una base anterior;
- mientras la PR seguía abierta, T-334 se mergeó a `develop` y cambió los mismos archivos;
- el branch quedó diverged y su árbol aislado no contiene `onboardingComplete`.

Esto encaja en controles existentes: un check verde del branch no prueba compatibilidad con un contrato que aterrizó después en base. No se propone AG nueva; la regla práctica ya es sincronizar base antes del cierre final y revalidar consumidores compartidos.

## Evidencia

H04 demostró otra vez que abrir la captura real aporta información distinta de leer el README. Se verificó directamente `360-06`.

## Sin AG nueva

H05 se puede prevenir con la rutina de sincronización final + tests que fijen los dos contratos. H06 es la directiva visual ya existente.
