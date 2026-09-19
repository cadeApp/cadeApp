# Manual de Operación y Guía de Prompts — cadeApp (agy)

> **Para el equipo:** Lautaro (`@Lautaro073`), Persona 2 y Persona 3.
> **Propósito:** Esta es la guía única y definitiva con los **prompts exactos** que cada persona debe copiar y pegar en agy para cada tarea. **Nadie tiene que inventar instrucciones ni saber programar:** agy sabe exactamente qué hacer al recibir estos prompts.

---

## 0. Las 4 Reglas de Oro (Para las 3 Personas)

1. **Nunca le pidas a agy "arreglá todo" ni "hacé que el test pase":** agy debe respetar las reglas de la ficha. Si algo falla y agy no lo resuelve solo, se cierra la sesión y se le consulta a Lautaro en el issue.
2. **Una sola tarea a la vez:** Nadie toma una tarea que no esté en la columna "Lista" del tablero de GitHub.
3. **Todo commit y avance se sube:** Nunca dejes código guardado solo en tu computadora. Al terminar el día o hacer una pausa, siempre se usa el prompt de cierre de sesión.
4. **Si agy se frena o el guard bloquea:** No insistas ni busques esquivar la traba. Copiá el mensaje de error y pegalo en el issue de GitHub arrobando a `@Lautaro073`.

---

## 1. Tabla de Prompts Universales (Copiar y Pegar)

Guardate estos 6 comandos. Son los únicos que vas a necesitar escribirle a agy:

| Situación | Qué prompt escribirle a agy | Qué hace agy automáticamente |
|---|---|---|
| **1. Empezar una tarea nueva** | `Tomá T-xxx de cadeApp con la skill tomar-tarea. Cumplí AGENTS.md y .agents/rules. Tocá solo los archivos permitidos de la ficha. Escribí primero las pruebas del DoD y mostrá que fallan.` | Crea la rama `feat/T-xxx`, lee los contratos, crea el borrador del PR, escribe los tests primero y programa la solución. |
| **2. Continuar una tarea (otro día o tras una pausa)** | `Retomá T-xxx con la skill retomar-tarea. Antes de cambiar nada mostrame el estado de los checks y qué dice la última entrada de la bitácora.` | Trae los cambios de GitHub, corre los tests para verificar que todo esté sano y continúa donde se quedó. |
| **3. Terminar la sesión / cerrar el día** | `Cerrá la sesión de T-xxx con la skill cerrar-sesion.` | Escribe la bitácora técnica, hace commit de lo avanzado y hace `git push` a GitHub para que nada se pierda. |
| **4. Tarea terminada: pedir revisión a Lautaro** | `Revisá el PR de T-xxx con la skill revisar-pr y dame el informe para pegar en el PR. No apruebes ni mergees.` | Audita el código, corre typecheck, lint y tests, y te da un texto listo para copiar y pegar en GitHub. |
| **5. Cambio de contrato o diseño insuficiente** | `El contrato no alcanza para T-xxx. Usá la skill contract-change y no sigas con la tarea.` | Frena el desarrollo y genera una propuesta formal de cambio para que Lautaro la autorice. |
| **6. Corte por límite de mensajes de agy** | *(En la terminal)* `git add -A && git commit -m "wip(T-xxx): corte por cuota" && git push` | Guarda todo de emergencia para que otra persona (o vos más tarde) pueda seguir. |

---

## 2. Guía Paso a Paso por Persona

---

### Persona 1 · Lautaro073 (Líder Técnico y Programador)
> **Tu zona:** Servidor, datos, base de datos, CI/CD y aprobación de todo el proyecto.

#### Tu orden de tareas:
1. **Día 0 (Manual):** Crear repo en GitHub, ramas `develop` y `staging`, organización en Supabase y los 2 proyectos Free Tier (`cadeapp-prod` y `cadeapp-staging`).
2. **T-000:** Scaffold inicial de Next.js.
3. **T-001:** Instalación del kit agy, CODEOWNERS e issues.
4. **T-002:** Supabase local (Docker) y configuración de proyectos staging/prod.
5. **T-003:** CI/CD (`ci.yml`, `migrate.yml`, `approval-policy.yml`).
6. **T-004:** Esquema de base de datos v1 y seed.
7. **T-007:** ADRs de Supabase y hosting.
8. **T-005:** RLS v1 y storage seguro (cierra `contracts-v1`).
9. **T-101:** RPC de ofertas.
10. **T-103:** RPC de solicitudes y estados.
11. **T-102:** Aceptación atómica (`accept_offer`).
12. **T-105:** RPCs de administración.
13. **T-104:** Cron y endpoint de salud.
14. **T-203:** Emisor de notificaciones push.
15. **T-310:** Backups, observabilidad y simulacro de restauración.

#### Cómo revisás los PR de P2 y P3:
1. P2 o P3 te avisan en GitHub que su tarea está en "Ready for review" con el informe de agy pegado.
2. Verificás que el check de CI en GitHub Actions esté en verde.
3. Si el informe no marca bloqueantes y CI está verde: **Merge squash** a `develop`.
4. Movés la tarea a "Hecha" en el tablero y avisás qué tareas se desbloquearon.

---

### Persona 2 · App de Comercio y Repartidor (Operador de agy)
> **Tu zona:** Pantallas del comercio, pantallas del repartidor, reglas de negocio de dominio y componentes de interfaz. **No necesitás programar: agy lo hace.**

#### Tu orden de tareas (hacer solo cuando esté "Lista"):
1. **T-006:** Dominio, estados y fake de base de datos *(se hace apenas Lautaro termine T-000)*.
2. **T-008:** Primitivas visuales y componentes base *(en paralelo con T-006)*.
3. **T-009:** Autenticación base: registro de comercio y repartidor, login y sesión *(espera a T-004 y T-005 de Lautaro)*.
4. **T-111:** Pantalla de alta de comercio y datos del negocio.
5. **T-112:** Pantalla de crear solicitud de envío con medio de pago.
6. **T-114:** Panel del repartidor (lista de pedidos disponibles y ofertar).
7. **T-113:** Pantalla de "Mis solicitudes" del comercio y aceptar oferta en vivo.
8. **T-115:** Pantalla de viaje activo y botones directos de WhatsApp.
9. **T-204:** Conexión en tiempo real con la base de datos.
10. **T-205:** Chequeo de accesibilidad y rendimiento en celulares.
11. **T-313, T-303, T-304, T-307:** Pruebas E2E automatizadas de los flujos de comercio y repartidor.

#### Tu rutina diaria con agy:
1. Abrí agy en la carpeta del proyecto.
2. Escribile:
   ```text
   Tomá T-xxx de cadeApp con la skill tomar-tarea. Cumplí AGENTS.md y .agents/rules. Tocá solo los archivos permitidos de la ficha. Escribí primero las pruebas del DoD y mostrá que fallan.
   ```
3. agy te va a ir mostrando qué hace. Si te pide confirmación para correr comandos de tests (`pnpm test`), dale permiso.
4. Al terminar tu turno de trabajo, decile:
   ```text
   Cerrá la sesión de T-xxx con la skill cerrar-sesion.
   ```
5. Cuando agy te diga que la tarea está completa y todas las pruebas pasaron:
   ```text
   Revisá el PR de T-xxx con la skill revisar-pr y dame el informe para pegar en el PR. No apruebes ni mergees.
   ```
6. Copiás el informe que te da agy, vas al Pull Request en GitHub, lo pegás como comentario y le pedís a `@Lautaro073` que lo revise.

---

### Persona 3 · Admin, PWA y Calidad (Operador de agy)
> **Tu zona:** Panel de administración, instalación de la PWA en celulares, notificaciones y calidad. **No necesitás programar: agy lo hace.**

#### Tu orden de tareas (hacer solo cuando esté "Lista"):
1. **T-201:** Instalación como PWA en iOS y Android y soporte offline *(se hace apenas Lautaro termine T-000)*.
2. **T-121:** Pantalla de registro de repartidores: subida de DNI, selfie y vehículo *(espera a T-009 y T-008)*.
3. **T-123:** Panel admin: gestión de comercios, piloto y suscripciones *(espera a T-105)*.
4. **T-122:** Panel admin: visor seguro de DNI y aprobación de repartidores *(con MFA)*.
5. **T-124:** Botón y panel de reporte de incidentes.
6. **T-202:** Cliente de notificaciones push en el celular *(espera a T-203 de Lautaro)*.
7. **T-301:** Configuración general del sistema de pruebas Playwright.
8. **T-302, T-305, T-306, T-308, T-309:** Pruebas E2E automatizadas de admin, seguridad y subidas lentas.
9. **T-311:** Páginas de términos legales y política de privacidad.

#### Cómo aprobás los PR de Lautaro (sin saber programar):
Cuando Lautaro sube cambios de base de datos o servidor, vos o P2 deben aprobar su PR:
1. Abrí agy y decile:
   ```text
   Revisá el PR de T-xxx con la skill revisar-pr y dame el informe.
   ```
2. Verificá en GitHub:
   - Que el check de GitHub Actions esté en **verde**.
   - Que el informe de agy diga que **no hay hallazgos bloqueantes**.
3. Si todo está verde, hacés clic en **Approve** en GitHub y dejás el comentario: *"CI verde e informe de agy sin bloqueantes. Aprobado."*

---

## 3. ¿Qué hacer si algo sale mal?

* **Si una prueba falla y agy no sabe resolverla:**
  Escribile: `Cerrá la sesión de T-xxx con cerrar-sesion`. Entrá al issue en GitHub y comentá:
  > *"@Lautaro073 me trabé en T-xxx. El test de [nombre del test] falla con este error: [pegar el error]. Ya cerré la sesión y está subido."*
* **Si agy dice que necesita tocar archivos fuera de la ficha:**
  Escribile: `No toques esos archivos. Cerrá la sesión con cerrar-sesion`. Y avisale a Lautaro en el issue.
* **Si el hook (`agent-guard`) bloquea un comando:**
  Significa que agy intentó hacer algo peligroso (como tocar claves o empujar directo a develop). Decile: `Ese comando está bloqueado por seguridad. Buscá otra alternativa permitida por las reglas o cerrá la sesión`.
