# Lecciones — PR #349

No se identificaron hallazgos. La reconciliación entre dos ramas divergentes debe basarse en la **comparación de árboles/blobs**, no solo en el recuento de commits: el merge anterior de staging arrastraba una genealogía divergente pese a tener únicamente 9 diferencias de contenido respecto a develop previo.

La prueba de CI de develop no acredita la release staging; se exige resultado real del HEAD de promoción antes de ejecutar el merge. No promover nuevas reglas a AGENTS.md por un caso sin falla.
