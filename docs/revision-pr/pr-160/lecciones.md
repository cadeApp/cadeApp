# Lecciones — PR #160

## Ronda 1

No se agrega un número AG nuevo en esta ronda. Los problemas encontrados ya están representados por patrones existentes:

- **P08-control-no-cubre-lo-que-dice:** un E2E puede ejecutar Playwright real y aun así no probar la aplicación si intercepta la propia navegación y devuelve su propio HTML.
- **P04-test-tautologico:** un mock no puede implementar la exclusión mutua que la prueba pretende verificar.
- **P06-enumeracion-incompleta:** nombrar un flujo en el título no equivale a ejecutar sus interacciones y efectos.
- **P03-comentario-contradice-codigo:** la bitácora no puede llamar “seed real” a un contexto que el spec nunca consume.
- **P19-cuerpo-de-pr-fuera-de-template:** el body debe aportar la evidencia verificable que exige el proceso.

## Ronda 2

Tampoco se abre un AG nuevo; la segunda ronda refuerza patrones ya catalogados:

- **P08:** un fixture “real” también puede invalidar el test si prepara un estado incompatible con el escenario o si el oráculo observa un síntoma genérico en vez del estado final.
- **P16:** cleanup E2E no puede limitarse a lo que creó el seed cuando el propio navegador crea filas adicionales. Toda escritura real del flujo tiene que entrar en tracking/descubrimiento.
- **P03/P19:** una línea de bitácora o checkbox no es evidencia si el SHA indicado no contiene el código probado o la propia sesión reconoce que la corrida no ocurrió.
- **P10:** una ronda de corrección sobre una rama muy atrasada obliga a repetir validaciones; arreglar contra una base vieja no cierra el hallazgo.

### Control a exigir en Ronda 3

Antes de mirar CI:
1. branch sincronizada con develop;
2. ninguna entidad creada por UI queda fuera del cleanup;
3. cada escenario usa datos propios y compatibles;
4. concurrencia afirma estado final exacto;
5. bitácora y body solo citan comandos realmente ejecutados sobre el SHA correspondiente;
6. cero `any`/non-null nuevos.
