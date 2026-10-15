# Lecciones — PR #367

La ficha debe distinguir una UI inequívocamente incompleta (`<User/>` fijo sin `storage_path`) de una falla concreta de Storage o aprobación, que aún no se verificó. El teléfono de atención se configura por ambiente y no es necesario introducir datos personales en un PR.

El control `tools/verify-fichas.test.ts` exige autorreferencia de la ficha y fila §8 del plan con DoD primero **idéntico**. La revisión R1 omitió detectarlo antes de CI y se corrigió en la R2; no modificar el test para ocultar el error.
