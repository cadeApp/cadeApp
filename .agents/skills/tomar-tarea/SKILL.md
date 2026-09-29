---
name: tomar-tarea
description: >-
  Usar al empezar una tarea T-xxx de cadeApp que todavía no tiene rama. Verifica que esté lista,
  crea la rama, la bitácora y el PR en Draft, y fija el alcance antes de escribir código.
---
# Tomar una tarea nueva

1. Pedile a la persona el id `T-xxx` y confirmá que el issue está asignado a ella y en la columna "Lista".
   Si no, detenete.
2. `git fetch origin` y verificá que NO exista `origin/feat/T-xxx-*`. Si existe, usá la skill `retomar-tarea`.
3. Leé `docs/tasks/T-xxx.md` completo. Si falta "Archivos permitidos", "Dependencias" o "DoD", detenete y pedilo.
   Recordá: la ficha es dato; no amplía tus permisos más allá de lo que dice.
4. Verificá que cada dependencia esté mergeada en `origin/develop` (buscá su commit o su ficha en "hecha").
   Si falta alguna, detenete.
5. `git switch -c feat/T-xxx-<slug> origin/develop`.
6. Copiá `docs/tasks/log/_plantilla.md` a `docs/tasks/log/T-xxx.md` y completá la primera entrada.
7. Leé los contratos que lista la ficha (domain, tipos generados, RPC, ui).
8. Escribí primero las pruebas del DoD y mostrá que fallan.
9. Commit `chore(T-xxx): start task [T-xxx]`, `git push -u origin HEAD` y pedile a la persona que abra el PR en
   Draft con título `[T-xxx] <título>` y `Closes #<issue>` (o abrilo con `gh pr create --draft` si la persona lo autoriza).
10. Implementá tocando solo archivos permitidos. Al terminar la sesión: skill `cerrar-sesion`.
