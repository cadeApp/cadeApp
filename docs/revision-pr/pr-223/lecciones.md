# Lecciones — PR #223

No se agrega una regla nueva por esta PR.

Observación: en SQL de PostgreSQL, `least` y `greatest` ignoran argumentos NULL cuando existe otro argumento no NULL. En cálculos compuestos conviene no razonar “la fórmula dará NULL” por intuición: los tests de T-330 mostraron que el comportamiento real podía producir una distancia enorme.

La regla útil ya existe: demostrar el defecto con RED y verificar la corrección en DB real/CI.
