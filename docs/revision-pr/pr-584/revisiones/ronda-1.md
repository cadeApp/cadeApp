# Informe de revisión — PR #584 / T-402 — ronda 1

**PR:** https://github.com/cadeApp/cadeApp/pull/584  
**Fecha:** 2026-11-03  
**Head de código revisado:** 2337c2a71f3bdfaa12aa782ca2269546926444a1  
**Base:** develop @ 2ed5ef14e6b87efbdedb36e4da18ad8bf08f624a  
**Resultado:** CON BLOQUEANTES (2). No se aprueba ni mergea.

## Alcance y comprobaciones iniciales

Se leyeron desde develop COMO-ENTREGAR.md, README.md, la skill revisar-pr y la ficha T-402. Se comparó la ficha modificada contra la original; se examinó el diff de 10 archivos, la bitácora, la API pública server.ts, el Sheet existente, reglas 20/25/40, el issue #483 y los comentarios de la PR. GitHub informa rama tres commits delante y cero detrás, sin revisión humana previa y con Preview Vercel publicado. No se ejecutó git merge-tree local ni se clonó el repositorio; mergeable=true indicado por GitHub no sustituye a ese control.

**NO CONFUNDIR:** typecheck/lint/test (189 archivos, 3459 pruebas) y E2E locales son afirmaciones de la bitácora del autor, NO ejecuciones independientes. Por tener bloqueantes no se dio por cerrado el CI ni se contaron sus jobs. No se ejecutaron pruebas E2E contra un Preview autenticado, ni Supabase local, ni Docker.

## PR584-H01 — BLOQUEANTE · Falta cobertura real del corte lg (P08)

**Archivo:** e2e/specs/admin-nav-mobile.spec.ts:67-96  
**Severidad:** medio / test-coverage. **Estado:** abierto, por inspección.

**Diagnóstico.** El spec fija viewport 390 × 844 y recorre siete secciones. No hay prueba a 1023, 1024 ni 1280 px, ni aserciones de geometría del main en el umbral. Por tanto, el control actual no demuestra que no queden ambas navegaciones ocultas entre md y lg, o que se reserve el ancho correcto de la barra lateral. No se afirma que la UI actual esté rota.

**Evidencia.** Lectura del spec en SHA exacto: 390 presente; 1023, 1024 y 1280 ausentes. Una verificación estructural independiente de fuente dio control 4/4 verde; al mutar en memoria las clases lg:hidden→md:hidden, lg:flex→md:flex, lg:w-64→lg:w-48 y flex-1→flex-none, las cuatro propiedades correspondientes pasaron a RED. Este control estructural NO prueba que Playwright detecte esos mutantes: el RED E2E sigue pendiente. Harness íntegro en evidencia/comandos.md.

**Arreglo indicado al autor.** Agregar test Playwright con administración autenticada y MFA como el caso existente, variar el viewport a 1023, 1024 y 1280 dentro de una misma sesión. A 1023, barra superior/«Menú» visibles, sidebar oculta, main en x≈0 y ancho≈1023. A 1024, header oculta, sidebar visible, main x≈256 y ancho≈768. A 1280, header oculta, sidebar visible, main x≈256 y ancho≈1024. En desktop verificar las 7 secciones con íconos y enlace/href correcto, activo marcado con aria-current, nombre de operador no vacío y botón «Salir». En móvil conservar navegación de 7 secciones, cierre y restitución de foco. Esperar estilos/hidratación mediante expect.poll o aserciones Playwright, no sleeps fijos. Tolerancia geométrica máxima razonable ±1 px.

**RED obligatorio.** Sobre un build local de la versión ya corregida (NO sobre el Preview inalterado), mutar temporalmente el header lg:hidden→md:hidden, dejar sidebar lg:flex, y demostrar que el caso de 1023 falla POR ASERCIÓN de visibilidad. Restaurar fuente en memoria/copia y demostrar GREEN. No adulterar expectations, no falsificar tests, no mocks que eviten producción. La PR real nunca lleva mutación.

## PR584-H02 — BLOQUEANTE de entregable · Capturas sin adjuntar (P15)

**Archivo:** docs/tasks/log/T-402.md:49-53 y DoD de docs/tasks/T-402.md.  
**Severidad:** bajo / conventions. **Estado:** abierto, acción humana.

**Diagnóstico.** El autor declara haber generado 15 PNG (7 × 1280, 7 × 390 y un menú abierto) fuera del repo. En la conversación de la PR al SHA revisado solo consta el comentario del bot Vercel, sin adjuntos de las capturas. El DoD requiere adjuntarlas a la PR, por lo que el entregable aún no está completo. La existencia y contenido de esas imágenes no fueron comprobados independientemente.

**Acción.** Lautaro073 adjunta manualmente los 15 PNG a la conversación de la PR tras comprobar que no expongan información personal de Supabase Develop. No pedir al agente guardarlos en el repo. El revisor verificará los adjuntos y sus dimensiones en ronda 2. Si aparecen datos personales, anonimizar antes de publicar.

## D01 — DECISIÓN AUTORIZADA, no bloqueante

Lautaro073 confirmó explícitamente el 2026-11-03 la opción A. Se conserva la ampliación de docs/tasks/T-402.md: siete secciones dinámicas de ADMIN_NAV_TABS y nueva query getAdminOperatorName bajo src/features/admin/queries.ts. No hay requerimiento de volver a cinco ni de cambiar la fuente de datos. La ampliación del archivo permitido fue comparada mecánicamente por diff; está circunscrita a queries.ts/queries.test.ts para la nueva función. La autorización es una decisión del usuario, no una verificación de RLS/runtime.

## Lo que sí está bien por inspección

- El mapa NAV_ICONS está exhaustivamente tipado contra los href reales de ADMIN_NAV_TABS; siete secciones actuales.
- Se reutilizan Sheet, BrandLogo y tokens existentes sin modificar contratos de src/ui ni dependencias.
- La consulta usa createClient de sesión y export público features/admin/server.ts, no el service role.
- Las mismas etiquetas y enlaces se generan desde navList para sidebar y Sheet; aria-current compara el pathname incluso en subrutas.
- El main usa min-w-0 flex-1; aside y header tienen clases lg complementarias. La verificación dinámica por ancho sigue siendo H01.

## NO TOCAR — observaciones descartadas por inspección

- No se debe exigir que la PR vuelva a cinco secciones: la opción A quedó autorizada.
- No se debe exigir un nuevo componente base ni introducir dependencias para el layout; usa los existentes.
- La consulta por sesión en lugar de service role es coherente con las reglas de acceso del proyecto.
- No se debe exigir CI nuevamente solo porque cambie la bitácora. Para nuevo código/test E2E sí corresponde verificar el nuevo SHA cuando se encuentre para aprobar.

## Por qué los checks declarados no alcanzan

| Evidencia del autor | Límite |
|---|---|
| 189 archivos / 3459 pruebas | No sustituye E2E en corte de breakpoint |
| E2E a 390 px y navegación de 7 rutas | No verifica 1023/1024/1280 ni geometría de main |
| Capturas generadas fuera del repo | Aún no fueron entregadas a la PR ni revisadas por privacidad |
| Clases lg correctas por inspección | No demuestra el comportamiento en navegador con CSS e hidratación |

## Método y estado de verificación

Se utilizaron las lecturas de GitHub sobre el SHA citado y una batería propia de mutaciones de cadena en memoria, sin escribir en la rama. Resultado observado: control estructural 4/4 GREEN y 4/4 mutantes RED; ausencia de tres anchos en spec. **Detección:** análisis de fuente, no runtime E2E. No se atribuye ningún test verde del autor a la revisión. Sin acceso a clon ejecutable en este entorno, quedan pendientes typecheck, lint, test, Playwright y log de CI en SHA posterior. No se levantan los bloqueantes ni se aprueba/mergea.

Cierre sujeto a ronda 2 tras push de H01 y entrega manual H02.
