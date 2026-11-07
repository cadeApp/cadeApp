# Lecciones — PR #528 / T-412

- **H02 (P06):** los retornos tempranos de estados vacíos tienen que incluir todos los banners / derechos vigentes, no solo el caso normal con listado. Caso concreto: `launchDiscountPct > 0` con `plans=[]` y `looseCreditReferencePriceArs=null`.
- **H03 (P08):** un schema `.strict()` no sustituye la validación de relaciones condicionales entre campos; los `CHECK` de SQL pueden funcionar como inventario para endurecer el schema de salida.
- **H01 (P15):** no tomar «dependencias mergeadas en develop» por la declaración del autor; verificar el estado de PR contractual y comparar HEAD con develop.
- **D01 (P10):** un renombrado adicional de admin, aunque sea solo UX, debe figurar en la ficha y contar con decisión explícita. Se aceptó A.
- **Seguimiento externo:** documentar vulnerabilidades audit preexistentes en issue separado (cf. #530), sin etiquetarlas como bug introducido por T-412 ni ocultar que CI está rojo.

No se asignan nuevos IDs AG sin cotejar el máximo en todas las ramas remotas. Se registran como instancias de patrones existentes.
