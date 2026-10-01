# Lecciones — PR #160

## Ronda 1

No se agrega un número AG nuevo en esta ronda. Los problemas encontrados ya están representados por patrones existentes:

- **P08-control-no-cubre-lo-que-dice:** un E2E puede ejecutar Playwright real y aun así no probar la aplicación si intercepta la propia navegación y devuelve su propio HTML.
- **P04-test-tautologico:** un mock no puede implementar la exclusión mutua que la prueba pretende verificar.
- **P06-enumeracion-incompleta:** nombrar un flujo en el título no equivale a ejecutar sus interacciones y efectos.
- **P03-comentario-contradice-codigo:** la bitácora no puede llamar “seed real” a un contexto que el spec nunca consume.
- **P19-cuerpo-de-pr-fuera-de-template:** el body debe aportar la evidencia verificable que exige el proceso.

### Refuerzo para la siguiente ronda

La revisión debe aplicar mutaciones propias sobre la implementación real, no reutilizar las mutaciones del autor. En particular:
- romper la revelación progresiva en código real y verificar que el E2E falle;
- romper la exclusión mutua real y verificar que el E2E de dos aceptaciones falle;
- romper al menos una acción de cada flujo (publicar, ofertar, retirar, ordenar, avanzar) y comprobar que el spec correspondiente se pone rojo.
