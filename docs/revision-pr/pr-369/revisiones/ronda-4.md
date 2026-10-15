# T-368 / PR #369 — Ronda 4: prefijo argentino incompleto aceptado erróneamente

**HEAD con falla reproducida:** `fb923c244e98d7a71fa284a6efb9ed84a943fbec`. [CI 38684491037](https://github.com/cadeApp/cadeApp/actions/runs/38684491037) `unit` FAILED con 1 caso genuino: el escenario `'+54 9 3865 123'` esperaba no crear enlace, pero renderizó un `<a>` de WhatsApp. Los otros 5 casos de T-368 pasaron y los 129 archivos restantes con 2159 tests existentes pasaron.

**Causa:** `buildWhatsAppUrl` acepta 10 dígitos nacionales. `5493865123` es un prefijo `549` incompleto (10 dígitos, en vez de 13), y el helper lo interpreta como diez dígitos nacionales, generando un enlace con prefijo duplicado. Un caso con `+54` incompleto también podría pasar al tener forma de 10 dígitos, por eso se verifica ambos patrones.

**Corrección:** en `getSupportWhatsAppHref` de la Server Page, antes de delegar al helper existente, rechazar `549` de longitud distinta de 13 y `54` de longitud distinta de 12; los números nacionales de 10 dígitos y las formas internacionales completas siguen pasando. Ampliar casos a `5493865123` y `+54 9 3865 12345`. No se alteraron expectations existentes ni la implementación compartida `src/lib/whatsapp.ts` fuera de ficha.

**Prueba RED real comprobada:** salida de `unit` de la corrida anterior: `FAIL src/app/(merchant)/merchant/plan/page.test.tsx > sin número válido (+54 9 3865 123)` y `AssertionError expected <a> to be null`. **GREEN todavía pendiente** hasta CI del nuevo HEAD; no falsificar.

**Riesgo/nota:** el helper compartido es más permisivo ante prefijos incompletos; se aisló la regla en esta frontera de entrada. Si aparecen otros consumidores afectados, abrir CC/issue de validación general antes de modificarlo globalmente.
