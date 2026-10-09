# Lecciones — PR #253 (T-309)

## Ronda 1
No se agrega numeración AG nueva.

- H02/H03/H04/H07 repiten P08: un E2E puede existir y no ejercer la propiedad o pantalla que afirma.
- H05 repite P06: “axe AA” se cruza contra la versión normativa vigente del proyecto, WCAG 2.2 AA.
- H06 aplica el lifecycle E2E existente: cleanup incluye Storage remoto, no solo DB/auth.
- H08 refuerza la regla de evidencia: una suite parcial no reemplaza el comando exacto del DoD.
- D01/1-A corrige la contradicción de ficha sin depender de una transitiva de pnpm.

## Ronda 2
Tampoco se agrega AG nueva.

- H09 vuelve a P08: al crear contextos manuales fuera del fixture se pierden opciones contractuales del runner; aislamiento de sesión no puede romper baseURL/contextOptions.
- H10 es aplicación directa de AGENTS §4: una aserción runtime no justifica introducir `!`.
- H11 es P08: el fixture del test es parte de la propiedad. Un “JPEG” corrupto puede volver rojo el test antes de la capa que dice probar.
- H12 es P08: “el servidor devolvió error” no equivale a “el servidor rechazó por MIME”; la razón del error forma parte del contrato.
- H06 deja una regla operacional: los recursos remotos se capturan para cleanup antes de cualquier aserción que pueda abortar el test.


## Ronda 3
No se agrega numeración AG nueva.

- H02/H06/H09-H12 quedan cerrados sin reglas nuevas: fueron aplicaciones directas de P08, cleanup E2E y convenciones ya vigentes.
- H07 deja una precisión operacional: si el guard fail-closed impide demostrar una mutación local que depende de staging, la evidencia RED debe obtenerse en Preview/CI con commits temporales explícitos y revertidos, nunca declararse por narración.
- H08 refuerza que ejecutar las suites “equivalentes” no sustituye un comando textual del DoD cuando ese comando devuelve exit distinto de cero.
- Separar superficies E2E independientes reduce enmascaramiento y permite demostrar varias mutaciones en un único run remoto.


## Ronda 4

No se agrega numeración AG nueva.

- Un E2E de accesibilidad que encuentra una violación real **está funcionando**, aunque el gate quede rojo. La salida correcta no es silenciar axe sino abrir/corregir el defecto de producto.
- Para distinguir regresión del PR de deuda preexistente se compararon blobs rama/develop. Los componentes que originan #296 y #297 son byte-a-byte los mismos en ambos refs.
- Un defecto preexistente sigue bloqueando un DoD que explícitamente exige “axe AA sin violaciones”; no se convierte automáticamente en waiver por ser anterior.
- Los fixes externos pertenecen naturalmente a la pasada de accesibilidad T-205 / #32, pero T-309 debe conservarse acotada y revalidarse después de que esos cambios lleguen a develop.
- Las mutaciones RED remotas pueden vivir como commits temporales **solo si quedan identificadas, su CI demuestra la sensibilidad y luego se revierten sin reescribir historia**.


## Ronda 5 — Evidencia positiva sobre el Preview correcto

La salida de un workflow `repository_dispatch` referencia el SHA del checkout de `develop`; para acreditar la prueba al código del PR, la revisión verificó el **deployment ID de Vercel** contra `meta.githubCommitSha=66630c1a548639be0e553e28685739f132050f4c`, además de leer los ocho nombres de casos T-309 en el log (no solo el indicador global `success`). La prueba de contraste/aria-hidden-focus se mantuvo íntegra, sin exenciones; las correcciones externas T-350/T-351 se integraron mediante merge normal de develop.

Al diseñar mutaciones independientes, corregir primero falsos RED del propio detector: un guard que falla su baseline no puede demostrar nada. La primera versión contó referencias de tags en el propio test y no distinguió el arreglo usado por `AxeBuilder`; la revisión la descartó y reemplazó por un detector sobre la declaración efectiva de tags y las cinco auditorías. Mantener el método trazable y no confundir estos checks estructurales con ejecuciones de navegador.
