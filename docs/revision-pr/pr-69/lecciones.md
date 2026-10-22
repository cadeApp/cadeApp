# Lecciones de la PR #69 (T-114) para `AGENTS.md` y las reglas

**Fuente:** Revisión de la PR #69 [T-114] Panel del repartidor.

## Patrón dominante

**Adherencia estricta a invariantes de privacidad (D3/D15) en la capa de UI y datos.** La tarea implementa el feed de solicitudes y ofertas garantizando que ni coordenadas (`lat`/`lng`), ni mapas, ni datos personales de contacto del destinatario viajen por la red ni se rendericen en el DOM.

---

## `AG-63` · Comprobación bidireccional de privacidad: red (queries) y DOM (componentes)

**Origen:** Ronda 1 de PR #69.

Para asegurar el cumplimiento de las restricciones de privacidad D3/D15 en interfaces públicas (como el feed del repartidor), la verificación no puede limitarse únicamente al renderizado del componente. Se requieren dos capas complementarias de aserciones:
1. **En las queries de datos (red):** Verificar que el objeto retornado por `getAvailableRequests` no contenga campos como `lat`, `lng`, `pickup_address` o `recipient_name` ni siquiera en propiedades opcionales o serializables.
2. **En la interfaz renderizada (DOM):** Verificar que el árbol DOM no contenga elementos de mapa (`iframe`, `canvas`, data-attributes de mapa) ni coordenadas numéricas expuestas en texto o atributos HTML.

> **Regla propuesta.** Toda feature que maneje solicitudes o ubicaciones del usuario debe contar con un spec de prueba que combine la inspección del payload retornado por el servidor (`JSON.stringify(data)`) y la inspección del contenedor renderizado (`container.innerHTML`), garantizando que la privacidad esté resguardada tanto en la red como en la pantalla.
