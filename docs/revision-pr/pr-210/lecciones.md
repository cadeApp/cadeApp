# Lecciones — PR #210 / T-328

## Ronda 1

No se agrega una regla AG nueva ni un patrón nuevo.

### Issue-first

T-328 se regularizó como excepción issue-first porque el bug apareció como bloqueante durante la revisión de T-306. Se siguió el precedente ya documentado en T-327: registrar la excepción de forma explícita es preferible a fabricar una ficha/bitácora retroactiva.

### Gate externo

Un gate rojo no se atribuye automáticamente al diff revisado. En esta ronda se inspeccionó el fallo exacto y se enlazó con #200 / CC-016 y con la nota vigente de T-327. La conclusión correcta es mantener el merge bloqueado sin adulterar ni saltear el test.

### Mutaciones

La batería del reviewer fue distinta a la del autor y detectó tanto usar la RPC equivocada como invertir el manejo del resultado. No se propone modificar AGENTS.md: el control existente de mutaciones ya produjo la evidencia esperada.
