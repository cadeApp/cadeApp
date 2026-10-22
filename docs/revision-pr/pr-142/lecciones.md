# Lecciones — PR #142 / T-318

## Ronda 2

- Anti-enumeración no es solo copy ni `ok`.
- Una ficha nueva debe preceder a la implementación.
- Una contradicción de alcance se resuelve separando planificación, no autoautorizándose.

## Ronda 3

### AG-01 · Incluir efectos laterales de autenticación en pruebas de indistinguibilidad

Una prueba que afirma comparar “todo lo observable” no puede limitarse al objeto retornado y al primer `router.push` cuando el framework puede persistir sesión/cookies y el middleware decide la navegación posterior.

> **Regla propuesta.** En pruebas de anti-enumeración de Auth, comparar también los efectos laterales de sesión relevantes cuando la API upstream puede autenticar automáticamente uno de los caminos. No fijar siempre `session:null` si una configuración soportada puede devolver una sesión.

## Ronda 4

La corrección confirmó la regla: el test con sesión no nula detectó el hueco, y mutar/eliminar `signOut({ scope:'local' })` vuelve a poner la suite en rojo. El control ya cubre la propiedad que faltaba.
