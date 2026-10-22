# Lecciones — PR #310 · T-351

No se generó ningún hallazgo nuevo. La evidencia principal fue la sensibilidad demostrada de las pruebas de componente y del E2E temporal frente a cambios de UI. La auditoría axe T-309 por sí sola siguió verde cuando faltaba «DNI frente»; la precondición adicional de cuatro `getByLabel` sí detectó esa mutación. Es un caso concreto de que un auditor de a11y no reemplaza controles semánticos de completitud de formulario.

Distinguir GREEN por caso y GREEN de corrida total: la rama temporal #309 se basó en T-309 y arrastró fallos ajenos a T-351. La PR productiva #310 no hereda el spec temporal, contiene el cambio visual y las pruebas de componente, y su propio E2E exact-head sí dio GREEN.

El check `approval-policy` rojo hasta publicar el informe independiente evita un merge prematuro; no se debe desactivar ese control para acelerar el flujo. No se añade regla AG por un único caso.
