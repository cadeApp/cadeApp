# Lecciones — PR #403

- La validación del tipo en la fila SQL no garantiza el tipo del archivo firmado. Si todos los documentos comparten una carpeta privada, exigir además el prefijo de `storage_path` correspondiente al `kind` antes de emitir una URL administradora. Corresponde al patrón P08 (control más débil que lo anunciado). Véase H01.
- La presencia de `img` y `token=` no demuestra entrega del recurso. En E2E probar descarga/decodificación y aislamiento desde otro actor real; documentar ejecución por SHA. H02.
- El autor no escribe `docs/revision-pr/**` ni certifica sus propios hallazgos. El informe previo se archivó como autorrevisión y no se descarta ni se borra su historia. H04.
- Los casilleros del DoD y el relato RED→GREEN deben respetar la evidencia efectivamente generada, incluso si CI unitario está verde. H05.
- No se asigna un nuevo ID `AG-xxx` hasta comprobar el máximo de todas las ramas remotas; evitar colisiones con lecciones de PR paralelas.

## Hallazgo nuevo de R2

- **H07 (P01/P08):** no se puede cambiar de cuenta en una misma `page` de Playwright navegando a `/login`, porque el middleware redirige a usuarios autenticados. Probar actores distintos en `BrowserContext` separados y exigir la existencia real del segundo usuario. Antes de dar una prueba E2E por válida, cruzar sus page objects con las guardas auténticas del sistema. No crear una regla global nueva por un solo caso.

## Ronda 3 — H08: controles que apuntan a un icono compartido

El icono `User` se usa tanto en `CourierNav` como en el fallback del avatar. Un selector global `.lucide-user` no diferencia ambas piezas, por lo que la E2E puede parecer verde aun si desaparece el fallback. Los placeholders accesibles deben tener nombre específico verificable por `getByRole`, y la batería RED debe retirar el **objeto del dominio**, no otro recurso de la página. Antes de elevar a `AG-xx`, contrastar con dos PRs distintas para no duplicar reglas por una sola incidencia.
