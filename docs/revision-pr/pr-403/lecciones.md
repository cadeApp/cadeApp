# Lecciones — PR #403

- La validación del tipo en la fila SQL no garantiza el tipo del archivo firmado. Si todos los documentos comparten una carpeta privada, exigir además el prefijo de `storage_path` correspondiente al `kind` antes de emitir una URL administradora. Corresponde al patrón P08 (control más débil que lo anunciado). Véase H01.
- La presencia de `img` y `token=` no demuestra entrega del recurso. En E2E probar descarga/decodificación y aislamiento desde otro actor real; documentar ejecución por SHA. H02.
- El autor no escribe `docs/revision-pr/**` ni certifica sus propios hallazgos. El informe previo se archivó como autorrevisión y no se descarta ni se borra su historia. H04.
- Los casilleros del DoD y el relato RED→GREEN deben respetar la evidencia efectivamente generada, incluso si CI unitario está verde. H05.
- No se asigna un nuevo ID `AG-xxx` hasta comprobar el máximo de todas las ramas remotas; evitar colisiones con lecciones de PR paralelas.
