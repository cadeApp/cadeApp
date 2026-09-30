# Lecciones — PR #142 / T-318

## Ronda 2

- Anti-enumeración no es solo copy ni `ok`.
- Una ficha nueva debe preceder a la implementación.
- Una contradicción de alcance se resuelve separando planificación, no autoautorizándose.

## Ronda 3

### AG-01 · Incluir efectos laterales de autenticación en pruebas de indistinguibilidad

Una prueba que afirma comparar “todo lo observable” no puede limitarse al objeto retornado y al primer `router.push` cuando el framework puede persistir sesión/cookies y el middleware decide la navegación posterior.

> **Regla propuesta.** En pruebas de anti-enumeración de Auth, comparar también los efectos laterales de sesión relevantes (creación/limpieza de sesión) cuando la API upstream puede autenticar automáticamente uno de los caminos. No fijar siempre `session:null` si la configuración soportada puede devolver una sesión.
