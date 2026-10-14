# Lecciones — PR #314 / T-339

## 2026-10-08/09 UTC — flujo UI con dos actores no puede reciclar estado de sesión

La PR #299 había dejado los E2E escritos pero no ejecutados (gate de migración). El primer E2E posmigración encontró que usar `loginAsCourier(0,page)` sobre la misma `page` autenticada del comercio provocaba redirección `307` de `/login` al dashboard merchant. El timeout de `waitForFormHydration` no demostraba bug de React. Antes de atribuir errores al módulo que aparece en el stacktrace, reproducir ruta real y estado de la cookie.

**Patrón:** `P01-contrato-de-framework-no-verificado` y `P08-control-no-cubre-lo-que-dice`; referencia de lecciones afines: `pr-63/AG-68`, `pr-68/AG-75`.

## Sincronizar asincronía por una señal observable, no por el click

El click en `take_request` es el comienzo de la operación, no confirma el commit remoto. La PR original leía PostgreSQL inmediatamente y podía ver `published` aunque la petición estuviera en curso. Esperar el aviso observable `¡Pedido tomado con éxito!` y verificar **después** el oráculo DB es una solución mejor que un sleep o un timeout mayor; conserva la verificación funcional y demuestra avance real.

## Disciplina de revisión

La primera revisión posmerge de #313 dedujo incorrectamente que los tests fallaban antes de publicar. La inspección posterior del artifact por el autor aclaró que el bloqueo ocurrió en el segundo login. El revisor debe separar lo observable directamente en el log (stacktrace) de la causa inferida por el documento. Dos runs RED intermedios + uno GREEN real, en SHAs declarados, aportan evidencia mucho mejor que la frase «tests verdes».

El issue #257 fue cerrado por board-sync al mergear #299, cuando la validación E2E seguía pendiente. Eso es deuda del proceso de cierre, no razón para cambiar `board-sync` ni para abrir alcance en esta PR de 2 archivos. Proponer seguimiento independiente antes de repetir este riesgo; no reservar nuevos números globales `AG-xx` sin conocer el máximo de todas las ramas.
