# Informe revisar-pr — T-431 — PR #688 — ronda 1 (2026-11-11)

**Resultado: CON BLOQUEANTES (2).** Código examinado: f7e2dc359491a56b4d4a54b2a703c788a7f32653; base origin/develop af023d3099e9e2ea15e3b78bf0cf5937e699058a. PR abierta, draft; no aprobada ni mergeada.

## Metodología y alcance

Leídos la ficha de develop, ampliación de la ficha en el PR, bitácora, descripción, comentarios, documentación y diff de 21 archivos. La PR está 5 commits adelante y 0 atrás de develop; GitHub indica mergeable=true. La ampliación de alcance (copy parametrizado, dos componentes compartidos, páginas courier y D01=A) fue autorizada por Lautaro073. Ningún archivo fuera de la nueva lista. Sin contratos, migraciones ni dependencias nuevas.

**Limitación:** el entorno no tiene clon utilizable ni pnpm, y git ls-remote a GitHub falló por DNS. No se ejecutaron los tests ni mutaciones en el SHA. El autor declaró 202 archivos/3764 tests verdes, typecheck y lint verdes. El run CI 43091526079 estaba en progreso al consultarlo; con bloqueantes no se toma como aprobación. La evidencia red.md fue creada por el autor y no se reprodujo independientemente. El script del revisor de comandos.md se validó solo con bash -n y queda para ejecutar en un entorno con checkout.

## Hallazgos anteriores y decisión

**H01 — arreglado-sin-verificar.** src/app/(merchant)/merchant/plan/notifications/page.test.tsx ahora monta el componente real y prueba ambas rutas (merchant con copy, courier por defecto). La evidencia R1 dice que quitar copy provoca RED. Inspección favorable, pero falta ejecución propia para marcar verificado.

**H02 — arreglado-sin-verificar.** docs/revision-pr/pr-688/evidencia/red.md incorpora R1–R3: mutaciones y extractos de pruebas rojas. R3 usa el placeholder git show origin/develop:<archivo>, no un script de modificación literal completo. Es evidencia del autor, no verificación independiente.

**D01=A — implementada por inspección.** MerchantNav activa Cuenta si pathname === '/merchant/plan' o empieza con '/merchant/plan/'. El test cubre ruta base, '/merchant/plan/notifications' y contraejemplo '/merchant/planes'. La solución es superior a startsWith('/merchant/plan') solo, que produciría falsos positivos.

## H03 — BLOQUEANTE ALTO — el wrapper nuevo pierde el fallback de error

**Archivo:** src/features/notifications/push/components/embedded-push-permission-prompt.tsx, líneas 6–22.

**[ANÁLISIS]** Antes, courier/profile/notifications/page.tsx importaba PushPermissionPrompt desde el barrel, cuya implementación de push-prompt-entry.tsx incluía PushPromptErrorBoundary con alerta «No se pudo cargar el control de notificaciones» y acción «Recargar la página». Ahora EmbeddedPushPermissionPrompt usa next/dynamic hacia './push-permission-prompt' directamente, sin boundary. El skeleton loading no es un error boundary. Afecta también la ruta courier en errores de carga o render; no se presupone que Next carezca de fallback global, sino que **se perdió el manejo recuperable local**.

**Arreglo exacto:** en embedded-push-permission-prompt.tsx importar PushPromptErrorBoundary desde '../push-prompt-entry' y envolver el componente actual:
  
    <PushPromptErrorBoundary>
      <PushPermissionPrompt embedded copy={copy} />
    </PushPromptErrorBoundary>

No volver a duplicar los componentes ni cambiar push-prompt-entry.tsx.

**Prueba:** en src/app/(merchant)/merchant/plan/notifications/page.test.tsx simular que el componente lazy arroja Error durante render (mock que invoque al real en el camino normal), montar las dos páginas y esperar role="alert", texto exacto del fallback y botón de recarga. RED antes del arreglo; GREEN después. Mutación posterior: quitar el wrapper y comprobar RED. Los tests actuales solo muestran textos correctos.

## H04 — BLOQUEANTE MEDIO — copy no se aplica a los errores de alta

**Archivo:** src/features/notifications/push/components/push-permission-prompt.tsx, líneas 18–39 y llamada a subscribeErrorMessage.

**[ANÁLISIS]** La nueva API define copy?: Partial<PushPromptCopy> y mezcla sus valores en text; sin embargo subscribeErrorMessage(code) lee directamente PUSH_COPY.prompt. Clase completa afectada: push_service_unavailable, permission_blocked, unauthorized, network_error, missing_vapid_key, missing_keys, unsupported, subscription_failed y default. Cualquier override de esos status se ignora. El comercio actual solo sobreescribe subtítulo y rapidez; no se afirma que los errores actuales estén mal personalizados en producción. Se señala contrato público incumplido y prueba faltante.

**Arreglo exacto:** cambiar a subscribeErrorMessage(code: string | undefined, text: PushPromptCopy); sustituir cada referencia del switch a PUSH_COPY.prompt.status* por text.status*, y usar setErrorMessage(subscribeErrorMessage(subResult.error, text)). No agregar un switch por rol.

**Prueba:** en push-permission-prompt.test.tsx, mockear requestNotificationPermission({isUserGesture:true}) con {ok:true} y subscribeToPush con {ok:false,error:'network_error'}. Renderizar <PushPermissionPrompt embedded copy={{statusNetworkError:'Error personalizado de prueba'}} />, click en «Activar avisos», esperar role="alert" y exigir ese texto, no el genérico. RED en HEAD actual y GREEN con el arreglo. Mutación inversa de text.statusNetworkError a PUSH_COPY.prompt.statusNetworkError debe dar RED. Tabla de casos para las demás ramas, sin mocks tautológicos.

## H05 — MEJORA DE PROCESO (bajo)

docs/revision-pr/pr-688/evidencia/red.md fue escrito por el agente autor dentro de la carpeta exclusiva de la revisión, contradiciendo COMO-ENTREGAR.md y pr-56/AG-36. Se **preserva** como evidencia autorreportada, pero no se marca verificada. El autor debe documentar próximos RED/GREEN en docs/tasks/log/T-431.md; prohibir escribir docs/revision-pr/** en su próxima sesión.

**Mejora no bloqueante:** la descripción del PR sigue diciendo audience y 3759 tests, aunque el nuevo código usa copy y el autor declara 3764. Actualizarla al terminar.

## NO TOCAR — falsos positivos descartados

- No introducir prompt automático: la ficha lo excluye.
- No cambiar contratos, src/ui, RLS, sender, promociones ni Supabase.
- No volver a audience: copy y los componentes únicos son decisión explícita del dueño.
- El componente mantiene alta/baja existente sin nueva vía exclusiva de push.
- El enlace whatsappLink(phone) conserva href wa.me, target blank, rel seguro, label por comercio y ausencia de link sin teléfono.
- Mantener el layout con main y TopBar y el prompt embedded.

## Por qué los tests declarados pasan

Las pruebas nuevas cubren textos (camino feliz), href y navigation, pero no fallas del lazy import/render ni códigos de error de subscribeToPush personalizados. La batería de mutaciones independiente está en evidencia/comandos.md. Ninguna mutación nueva se declara RED ejecutada aquí.

## Checklist

- [x] Ficha base y ampliación autorizada; archivos permitidos.
- [x] H01, H02, D01 contrastados por lectura.
- [x] Hallazgos H03/H04 enumerados por clase y por causa.
- [ ] Pruebas RED nuevas, arreglos GREEN y mutaciones propias H03/H04.
- [ ] Tests/typecheck/lint en SHA de arreglo, y revisión ronda 2.
- [ ] Descripción PR actualizada; bitácora de implementación al día.

El commit de esta revisión solo mueve documentación: el SHA de código examinado y los campos verificado_en_sha permanecen anclados a f7e2dc35 y null respectivamente. No exigir un CI nuevo solo por este commit de documentación.