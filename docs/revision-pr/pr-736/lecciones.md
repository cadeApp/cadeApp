# Lecciones — PR #736 / ronda 1

**No se reserva un AG nuevo.** Este caso refuerza lecciones existentes sin disputar numeración global de ramas remotas.

- **pr-56/AG-37 — enumerar la clase entera:** no alcanza comprobar un UPDATE restringido si el callback acumula INSERT/UPDATE de dos IDs para cuatro actores. Hay que **recorrer toda la colección** después de la barrera y ventana, incluidos eventos tardíos y los opcionales.
- **pr-68/AG-75 — batería independiente del autor:** el test real pasó, pero seis eventos/errores adversos aislados en simulador muestran que las expectativas actuales no están completas. La revisión agrega mutaciones propias al oráculo, sin tocar Develop ni fingir una fuga real.
- **pr-63/AG-68 / pr-62/AG-60 — contrastar evidencia con propiedades:** un log correcto del run demuestra privacidad observada, no que fallaría por todas las variantes de fuga. El control S exige ambas columnas y ambos valores para evitar verde parcial; no solo notes.
- **pr-56/AG-34 — negativos de autorización:** para `anon` el resultado de PostgREST esperado aquí es `42501` (CC-023). Tratar `500`, `42501` y una lista realmente vacía como el mismo `[]` borra el oráculo.
- **Control de cleanup:** `finally` tiene que verificar la restauración y garantizar que **todos** los canales se intentaron remover, incluso ante un error. Una prueba de limpieza solo por ruta exitosa no certifica aislamiento en Develop.

No agregar reglas de `AGENTS.md` con una sola PR. Se debe comprobar RED de los oráculos corregidos mediante un harness local real de sus funciones; los payloads artificiales del harness NO equivalen a una fuga capturada por Realtime.

## Ronda 2 · H04 residual: la limpieza depende del cierre de todos los productores de canales

- **Relación:** `pr-56/AG-37` (enumerar la clase) y lección de cleanup de R1. No se numera un AG nuevo.
- El revisor había exigido `Promise.allSettled` en el retiro de canales, y el agy lo implementó correctamente. Sin embargo, el alta seguía siendo `Promise.all(subscribe(A), subscribe(M), subscribe(N), subscribe(S))`: un fallo rápido de A hace entrar al `finally` mientras M todavía puede estar en `await getSession()`; cuando M se registra después de la limpieza, queda un canal huérfano.
- **Prueba independiente:** scheduling determinístico con gate: canal M creado luego de `finally` y no removido (`orphaned=1`). Cambiando solo la barrera de alta a `await Promise.allSettled(subscriptions)`, se esperan todas las operaciones y M se remueve (`orphaned=0`).
- **Regla candidata:** para recursos que se crean de manera asíncrona, antes del teardown hay que haber terminado **todos los creadores**, no solo hacer `allSettled` sobre los recursos ya registrados. Una promesa rechazada puede esconder creadores aún vivos.
- **Corrección del juicio previo:** registrar error de cleanup con `console.error` cuando ya hay error en el cuerpo no es una falla: evita ocultar la causa primaria y conserva evidencia. No exigir que un `finally` reemplace el error original. El nuevo bloqueo es exclusivamente el registro tardío.
- No pedir nuevos CI por los commits de bitácora o revisión; sí verificar la captura sobre el siguiente SHA de implementación.

## Ronda 3 · verificación de la barrera de altas y del gate

- El arreglo de `PR736-H04` en `ecb04e80` espera **todas** las promesas creadoras mediante `Promise.allSettled`; solo entonces relanza la primera falla. Así preserva la falla del cuerpo y evita registrar un canal después del `finally`. Confirma el mecanismo enunciado en R2 (pariente de pr-56/AG-37); **no requiere otro AG**.
- La batería independiente de R3 no es la del agy: control original con fallo antes de registrar el canal y después de registrarlo **2/2 GREEN**; mutantes (volver a `Promise.all`, ignorar la falla, limpiar solo canales de suscripciones exitosas) **3/3 RED**. Es un harness local de scheduling, no una llamada a Develop.
- `e2e-preview` 43322939621 muestra `CC-051 PASS` sobre `ecb04e80` mientras el run completo da **121 passed, 3 failed** por casos de onboarding previos a #737. No confundir éxito del caso revisado con gate global verde.
- `ab32909f` trae `origin/develop@434ee222` y el arreglo de #737 sin modificar `courier-private-columns.spec.ts`. La revisión de código puede terminar sin bloqueantes, pero el DoD de *run completo verde después del merge* sigue pendiente hasta evidencia específica del head posterior al merge.
- Mantener el error original del cuerpo y registrar una limpieza secundaria incompleta sigue siendo una decisión técnica correcta. El control independiente comprueba que todos los intentos de retirada se ejecutan antes de cerrar.
