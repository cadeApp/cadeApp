# Informe de revisión — PR #255 / T-337

**PR:** https://github.com/cadeApp/cadeApp/pull/255  
**Head SHA revisado:** `32676728ef47da9c8057a1e2e2c19063044ea36f`  
**Base:** `develop` @ `1cd3da01b3af9619e4a19107ba5e8354a18c2159`  
**Fecha:** 2026-10-05

## Cómo leer este informe

La revisión independiente no toma como verificación el bloque «Informe de revisión de agy» escrito por el autor. Se contrastaron ficha desde `develop`, diff, bitácora, reglas E2E, comentarios de la PR y el contrato real de React 18.3.1.

La decisión 🔵 se consultó antes de cerrar: Lautaro073 eligió **A — mantener todo en E2E y no tocar `src/**`**.

## Resumen por prioridad

| # | Severidad | Archivo | Problema | Tipo |
|---|---|---|---|---|
| PR255-H01 | medio · **BLOQUEANTE** | `e2e/helpers/hydration.ts:33-39` | `__reactProps$*.onSubmit` aparece antes de que el Fiber quede committed/mounted | P01 |
| mejora | bajo | `e2e/pages/login.page.ts:56` | `toHaveValue(password)` puede incluir la contraseña esperada en el error | no bloqueante |

## 1. 🔴 PR255-H01 — la señal de hidratación puede dar verdadero antes del commit

**Archivo:** `e2e/helpers/hydration.ts:33-39`  
**Estado:** [VERIFICADO] por contrato de React + harness independiente

### Diagnóstico

La ficha y el helper equiparan «el formulario tiene `__reactProps$*.onSubmit`» con «el formulario ya está listo para recibir eventos». React 18.3.1 no garantiza eso.

En `hydrateInstance()`, React primero asocia el DOM node al Fiber y escribe las props con `updateFiberProps`; el propio fuente deja un TODO indicando que esa escritura quizá debería diferirse hasta commit. Por separado, el despachador de eventos calcula `getNearestMountedFiber(targetInst)` y, si el target todavía no está montado, ignora el evento como evento sobre árbol no React.

Por lo tanto existe un estado válido de React donde:

- `__reactProps$*.onSubmit` ya es función;
- el Fiber sigue marcado `Hydrating` o `Placement`;
- el predicado actual devuelve `true`;
- React todavía no considera ese target montado para despachar normalmente el evento.

Eso deja abierta exactamente la clase de carrera que T-337 pretende eliminar.

### Evidencia

Fuentes de React 18.3.1:

- `ReactDOMHostConfig.hydrateInstance`: llama `precacheFiberNode` y `updateFiberProps` antes del commit y contiene el TODO «Possibly defer this until the commit phase».
- `ReactFiberTreeReflection.getNearestMountedFiber`: para fibras nuevas, `Placement | Hydrating` significa que la inserción/hidratación sigue en progreso.
- `ReactDOMEventListener.findInstanceBlockingEvent`: si `nearestMounted !== targetInst`, trata el evento como anterior al commit y descarta el target.

Harness independiente de esta revisión:

```text
precommit/current= true
precommit/mounted= false
postcommit/current= true
postcommit/mounted= true
```

El primer renglón demuestra el falso positivo: el predicado actual acepta un formulario con `onSubmit` aunque su Fiber todavía tenga `Hydrating`.

### Por qué el spec actual no lo detecta

`e2e/specs/login.spec.ts` retiene todos los chunks. Eso prueba dos extremos útiles:

1. React todavía no cargó → no hay props;
2. se liberan chunks → eventualmente React termina.

No construye ni observa el intervalo intermedio «props ya adjuntas, commit todavía pendiente». Por eso las corridas verdes son compatibles con este agujero.

### Arreglo acordado — decisión A

No tocar `src/**` ni agregar `data-hydrated`.

En `e2e/helpers/hydration.ts`:

1. conservar la comprobación de `__reactProps$*.onSubmit`;
2. obtener el `__reactFiber$*` del mismo `<form>`;
3. exigir que ese Fiber ya esté montado siguiendo el criterio mínimo equivalente a React 18.3.1 `getNearestMountedFiber`, en vez de asumir que las props prueban commit:
   - `Placement = 2`;
   - `Hydrating = 4096`;
   - `HostRoot = 3`;
   - si el Fiber no tiene alternate, recorrer `.return` y rechazar mientras él o un ancestro tengan `Placement | Hydrating`;
   - confirmar que la cadena termina en `HostRoot`.
4. encapsular esos internals en este helper y documentar que están ligados a React 18.3.1.

No usar únicamente `root.stateNode.current === root`: React alterna las dos ramas Fiber después de updates; el criterio tiene que ser de «mounted» y no una igualdad frágil con una sola rama.

### Cómo verificar

Agregar en el mismo `e2e/specs/login.spec.ts` un caso de contrato del helper, **además** del E2E real:

- crear DOM mínimo con `form > button`;
- adjuntar al `form` `__reactProps$test = { onSubmit() {} }`;
- adjuntar un `__reactFiber$test` cuya fibra target tenga `flags = 4096` y termine en un HostRoot;
- comprobar que `waitForFormHydration` **no resuelve** en ese estado;
- cambiar `flags` a `0` y comprobar que resuelve.

Mutación RED obligatoria: quitar/puentear la comprobación de Fiber y volver a aceptar solo `onSubmit`. El caso anterior debe quedar rojo. Restaurar el fix y mostrar verde. Este test sintético mide el contrato del helper; **no reemplaza** el spec real con chunks retenidos.

Después correr el spec real con `--repeat-each=5 --workers=1` y dejar que el gate automático de la PR corra sobre el SHA final.

## 2. 🟡 Mejora — no imprimir el password esperado en un matcher

**Archivo:** `e2e/pages/login.page.ts:56`  
**Estado:** [ANÁLISIS] · no bloqueante

`await expect(this.passwordInput).toHaveValue(password)` puede incluir el valor esperado en el mensaje de fallo de Playwright. En los flujos con seed ese valor es una credencial E2E generada para una cuenta real de Develop durante la corrida.

Una variante futura puede conservar igualdad exacta sin incluir la contraseña en el diff del matcher, por ejemplo comparando el resultado como booleano con un mensaje neutro.

No se pide tocar esta mejora en la ronda de arreglo: cambiar `login.page.ts` invalidaría la cláusula de la ficha que permite usar las tres corridas previas con el mismo page object y obligaría a repetir innecesariamente ese gate.

## NO TOCAR — falsos positivos ya descartados

| Supuesto problema | Por qué no lo es |
|---|---|
| «Hay que poner un `data-hydrated` con `useEffect` en `LoginForm`» | Es una solución válida, pero Lautaro073 eligió A: mantener el mecanismo fuera de producción. |
| «Hay que subir el timeout» | T-337 prohíbe explícitamente esconder la carrera con más timeout. |
| «El spec con chunks es inútil» | Sí cubre el caso extremo pre-hidratación y debe conservarse; solo le falta cubrir el intervalo props-before-commit. |
| «Los tres gates verdes demuestran que no hay carrera» | Demuestran estabilidad observada, no que el predicado sea equivalente al estado mounted de React. |

## Por qué los checks verdes no alcanzan

| Check | Qué dice | Qué no ejerce |
|---|---|---|
| `login.spec.ts` actual | No se completa/envía mientras los chunks están retenidos | Props presentes con Fiber aún `Hydrating` |
| `e2e-preview` 3/3 | La implementación funcionó en esas corridas | La ventana interna props-before-commit |
| typecheck/lint/unit | Tipos, reglas y tests generales | Semántica de internals de React durante hidratación |

La corrida `e2e-preview` verificada en logs reportó `30 passed` + `3 passed`; se conserva como evidencia de estabilidad, no como prueba de H01.

## Checklist de verificación final

- [x] Ficha leída desde `develop`.
- [x] Rama revisada estaba 0 commits detrás de `develop`.
- [x] Los 5 archivos modificados estaban dentro de «Archivos permitidos».
- [x] No hay cambios de contratos, dependencias, workflows ni código productivo.
- [x] Comentarios y bitácora contrastados.
- [x] Hallazgo H01 demostrado con harness independiente.
- [x] Decisión 🔵 consultada: opción A.
- [ ] H01 corregido y revalidado en un SHA posterior.
- [ ] Gate automático verde sobre el SHA de arreglo.
- [ ] Ronda 2 independiente.

## Metodología

La sesión no dispone de checkout ejecutable del repositorio, por lo que no se presenta `pnpm typecheck/lint/test` como corrida propia. Con un bloqueante abierto, esta ronda se cierra como revisión estática + harness dirigido; los resultados de CI existentes se inspeccionaron solo como contexto y no sustituyen la revalidación de H01.
