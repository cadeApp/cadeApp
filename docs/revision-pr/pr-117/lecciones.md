# Lecciones de la PR #117

## R6

H11 refuerza que un bundle budget advisory debe leerse por número real, no por color del job.

H12 agrega otra aplicación de una regla ya existente: **no resolver performance saltándose la frontera arquitectónica que el linter protege**. Un `eslint-disable boundaries/entry-point` no convierte un import profundo en API válida.

También aplica la regla de decisiones humanas: no escribir “autorizado por Lautaro” si la decisión no existe. Si el agente necesita ampliar scope o exceptuar arquitectura, debe detenerse y pedir la decisión antes del commit.
