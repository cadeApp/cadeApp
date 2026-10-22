# Lecciones — PR #212 / T-328

La reaplicación confirma que el bloqueo previo de T-328 no pertenecía al fix sino a CC-016. Con CC-016 en la base, el mismo blob funcional de T-328 mantiene CI GREEN y el E2E pasa 9/9.

No se agrega una regla nueva. La secuencia merge accidental → revert → reaplicación se documenta sin reescribir historia.
