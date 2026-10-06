# Lecciones — PR #251 / T-313

- H05: la ownership de recursos E2E creados por UI debe registrarse antes de disparar la acción y reconciliarse desde teardown, no desde el happy path.
- H06: un RED discriminante necesita fallar exactamente en la propiedad añadida y luego volver a GREEN tras revert; los runs 37425374360 y 37428952648 son el ejemplo válido.
- H04 confirma la separación entre CI estructural GREEN y gate funcional E2E RED: ambos datos deben mantenerse visibles.
- No se agrega AG nueva en esta ronda; los patrones siguen cubiertos por P08.
