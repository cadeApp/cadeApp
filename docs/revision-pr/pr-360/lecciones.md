# Lecciones PR #360

Ronda 2: las correcciones H01/H03/H04/H06 son consistentes por inspección; H02 evidencia que `router.refresh()` no constituye bloqueo sincrónico de acciones con props viejas.

- P08: `expect(mockRefresh).toHaveBeenCalled()` no prueba que los botones Aceptar desaparezcan durante la carrera.
- P01: el oráculo de DB puede adelantarse a la navegación SPA; seleccionar `winnerPage` requiere espera observable, no un ternario inmediato por URL.
- AG-36: GREEN de CI no reproduce los RED previos, y autor no puede certificar `verificado_en_sha`.

**Corrección del propio revisor:** la batería de ronda 1 usaba un ancla `result.request.status` que no existe después de `const { request } = result`; se habría reportado SIN OBJETIVO. Esta es falla del instrumento, no del autor. La ronda 2 corrige esa ancla; sin ejecución no afirma mutaciones verificadas.

No se asignan lecciones AG-xx nuevas sin relevar la numeración de todas las ramas.

## Ronda 3 — de test a contrato observado

- **P01 (R02):** `replace` no significa que Back se queda donde estás. El E2E debe medir el requisito observable (ausencia de Aceptar tras match), no una ruta específica de historial que el DoD nunca impuso. El propio revisor sugirió probar Back sin precisar esta diferencia en ronda 2: **omisión nuestra al formular el prompt**, que aquí se documenta.
- **P08 (H05):** `if (winningOffer) expect(monto)` no es buena aserción del dinero aunque un oracle DB previo garantice que existe; afirmar explícitamente identidad de oferta y actor, no saltar el control.
- **P01 (R01):** esperar primera URL reduce flakiness de velocidad, pero no demuestra *quién* ganó: los dos contextos pueden llegar al mismo viaje por mecanismos diferentes. La distinción de causalidad viene de `acceptedOfferId` o del error ALREADY_MATCHED, no de URL.
- **AG-36 / H07:** el autor aportó ahora un RED razonablemente concreto para H02, pero el revisor no lo reprodujo; esa precisión documental es mejora real, no verificación independiente.

No proponer AG-xx nuevo sin máximo de todas las ramas y evidencia ejecutada.
## Ronda 5 — deploy READY vs E2E real y guía vigente

- H05 / P15: el workflow `resolve-preview` verde representa una decisión de seguridad de no correr (`run=false`), **no prueba Playwright**, aunque el deployment Vercel esté READY. El check de commit debe tener contexto `e2e-preview` del SHA y resultado real.
- Diagnóstico separado: gate correcto por `project.id` vs configuración de webhook por proyecto. El revisor no debe tratar un deployment de `cadeapp-staging` como el Preview seguro de `cadeapp-develop`. La existencia de ambos proyectos/depoys no demuestra cuál entregó el evento.
- La configuración de webhooks devolvió 403. Una hipótesis acerca de un hook ausente se registra como **posibilidad no comprobada**, no como defecto asegurado. Las correcciones en settings requieren acceso del dueño; jamás leer secretos.
- Regla de ubicación: las instrucciones expresas del usuario indican `docs/revision-pr/pr-NN` en la rama de PR incluso P2/P3, reemplazando la tabla histórica de `COMO-ENTREGAR.md`. El error anterior de escribir ronda 4 solo en `docs/revisiones` se remedia copiándola y siguiendo el nuevo mandato en ronda 5.

## Ronda 6 — PR360-R03 (E2E RED verdadero)

- **P07:** en una pantalla con importe duplicado por diseño (tarjeta del repartidor y mensaje del cliente), `page.getByText(formattedAmount)` de Playwright strict mode no es un oráculo único. Se debe anclar a la sección semántica del dato que se desea validar, sin reducir la prueba a `.first()` o `toHaveCount(2)`.
- **Error de revisiones anteriores:** inspeccioné el código de `TripMerchantView` sin detectar que el importe estaba en el mensaje construido por `buildNotifyCustomerWhatsAppMessage`. El E2E real detectó esa omisión. Reconocerlo y no pedirle al agy cambios de producto por un bug de selector propio del E2E.
- La suite global verde no ejecuta los asserts de navegador. La primera ejecución E2E (75 PASS, 1 FAIL) es evidencia superior al supuesto de verde basado en existencia de test.
- La comprobación debe alcanzar la línea previa al reload y la posterior, y los asserts de WhatsApp, Back y privacidad que aún no alcanzó el flujo. No agregar número de lección AG sin relevar el máximo de todas las ramas remotas.

## Ronda 7 — GREEN en Preview vs merge futuro

- RED→GREEN de un mismo test sí quedó acreditado: run 38694202782 vs run 38945199224, conservando comprobación monetaria en la Card y después de reload.
- El E2E del SHA de una PR desfasada no certifica automáticamente la combinación con nuevos cambios de develop. Nuevas modificaciones de WhatsApp/TripMerchantView y el E2E compartido justifican revalidar después de merge normal. Esto es riesgo hipotético, no defecto funcional confirmado.
- Sin mutaciones independientes del revisor no se firma verificado_en_sha, aun con CI en verde.

## Ronda 8 — Cancelaciones de cola y trazabilidad de HEAD

- Un gate `resolve-preview SUCCESS` (identidad validada) junto con `e2e-preview CANCELLED` (cero pasos) es validación **no realizada**, no una falla de dominio ni un PASS; el status error conserva el bloqueo de merge.
- T-327/#205 ya registra la decisión 5-A de P1 de aceptar que 1 running + 1 pending puede cancelar otros pendientes; no se abre cambio infra ni se interpreta automáticamente como bug de producto. Un re-run de un dispatch legítimo existente es distinto de inventar un workflow manual.
- Composición de develop tras E2E verde anterior exige nuevo E2E. En esta ronda el código de T-359 permanece estable y CI unit/DB pasa, pero eso no sustituye el resultado real del navegador.

## Ronda 9 — PR360-R04 / P08: test verde por efecto lateral de otro componente

- El E2E afirmaba visualizar `Medio de pago: Efectivo` pero el elemento estaba en el texto de WhatsApp al cliente, **no** en el resumen del viaje. El refactor legítimo T-361 del mensaje reveló la ausencia del dato visual. La aserción necesita un locator en la sección responsable del contrato, no un `page.getByText` global.
- Advertencia multidrop: el método de pago se modela por entrega. Una etiqueta global basada en `TripDetails.recipientPaymentMethod` podría describir sólo uno de varios destinatarios; probar escenarios heterogéneos cash/transfer/to_agree.
- La T-360 mostró flaky por login que no salió de pending en un intento y pasó en retry. Sin causa demostrada no cambiar timeouts, credenciales ni suprimir el caso en T-359; registrar sólo el hecho.
- Reconocer omisión de revisión anterior: el test ya dependía de un texto de WhatsApp incidental. RED recién se comprobó con integración real de develop.

## Ronda 10 — PR360-R05 / contrato temporal de expiración

- La nueva UI C es consistente con el dato estructurado por drop y el E2E T-359 pasó, pero el gate total falla por un test de otra tarea integrado de develop. **Separar T-359 runtime PASS de E2E global RED** para no certificar merge con suite incompleta.
- T-366 asume que una solicitud `published` con `expires_at` vencido debe seguir mostrando el botón `Aceptar`, mientras el DoD T-366 dice ofertas vencidas no aceptables. La contradicción está en la expectativa, no prueba que el producto esté roto. Corregir no equivale a saltarse el test si se mantiene oráculo RPC `REQUEST_EXPIRED` y se exige explícitamente `toHaveCount(0)` en UI.
- Las pruebas de medio de pago de la opción C están ancladas por Card y distinguen cash, transfer, to_agree. Los 4 mutantes del revisor fueron textuales, no de ejecución Vitest; distinguir ambos niveles de evidencia es obligatorio.
- Las nuevas decisiones de UX que cruzan T-359/T-366 deben quedar registradas en la ficha canónica de la tarea propietaria; no modificar test fuera de alcance de la PR para conseguir verde.
