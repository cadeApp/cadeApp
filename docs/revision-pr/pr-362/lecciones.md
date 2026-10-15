# Lecciones — PR #362 / ronda 1

No se asigna un AG nuevo: se reutilizan los patrones existentes mientras no pueda enumerarse con `git` el máximo de todas las ramas. Evitar colisiones de numeración.

- **P08 y AG-37:** una matriz de `safeParse().success` no sustituye el barrido de **todas** las fronteras `Actions → RPC/persistencia → E2E`. El valor normalizado debe afirmarse, no solo el booleano.
- **P04:** un test de comportamiento positivo no puede aceptar `success=false` como alternativa: el rechazo total equivale a invalidar la función y dar verde al mismo tiempo.
- **P06:** no reutilizar una única expresión para nombres/direcciones y textarea de notas, donde CR/LF/TAB tienen semántica legítima.
- **AG-70:** una prueba roja debe caer por su aserción del invariante, no por un fallo previo del mock ni por un import inexistente.
- **Decisión 1B:** evitar introducir una regla comercial sin contrato de servidor; el límite de un `integer` de Postgres NO define un precio recomendado, solo la cota técnica. Si el negocio necesita otra, definir CC aparte.

En una nueva ronda, agregar mutaciones propias a lo que el autor arregle, sin adoptar ciegamente su batería.

---

## Ronda 2 (SHA `5dfb57b`)

No se asigna AG nuevo sin enumeración remota completa de todas las ramas.

- **H08 — P04/P08:** en E2E está prohibido envolver TODAS las aserciones en `if (await locator.isVisible())`. Un campo ausente debe poner el test en rojo, no omitirlo silenciosamente.
- **H06:** desaparecer un error no equivale a completar una operación válida; el test tiene que observar su efecto posterior y el destino esperado.
- **H07:** la bitácora append-only no debe presentar números de línea inexistentes como prueba de una ejecución; citar el nombre de la prueba y pegar salida capturada verificable. Una descripción de lo que hubiera fallado NO equivale al rojo real.
- **H01-H05:** los cambios son consistentes por inspección; falta ejecución y mutación independiente, sin prematuro `arreglado-verificado`.

---

## Ronda 3 (`55fa228`)

- **H08**: exigir `expect(locator).toBeVisible()` antes de validar un campo, nunca condicionar toda la suite a `isVisible()`. La versión nueva corrige la estructura, falta un run real.
- **H06 — invariante de no-escritura**: la ausencia de navegación no es un proxy válido de ausencia de escritura; contrastar conjuntos de IDs en DB antes/después y correlacionar el recurso creado con las comprobaciones y cleanup.
- **H07 — trazabilidad de RED**: listar nombres correctos de tests es bueno, pero no reemplaza la **salida roja real** de una prueba de sensibilidad. Anotar la imposibilidad de mutar de manera segura si ocurre, sin mentir.
- Evitar interpretar `Vercel Preview Comments = success` como `e2e-preview = success`; el gate publica contexto de commit aparte después de `repository_dispatch`.

---

## Ronda 4 (`aa191cbc`)

- **H06:** verificar el registro creado con diferencial exacto de IDs y comprobar que la ruta inválida no generó filas: P2 lo implementó correctamente en la spec, pero sin correr E2E no se puede certificar.
- **H07:** neutralizar `if (!parsed.success)` y observar `TypeError` de `parsed.data === undefined` no es una mutación válida de comportamiento de negocio. Mutar **solo el predicado semántico** para que `safeParse` siga entregando `data` y ejercer RPC/escritura; si el test cae por aserción, evidencia útil.
- **CI:** deploy exitoso y `unit` exitoso no sustituyen `e2e-preview`, contexto que se publica mediante dispatch confiable. No atribuir ausencia de evento a causa específica sin evidencia.

---

## Ronda 5 (`c751cc8`)

- **H07 (P08):** una mutación semántica que mantiene `parsed.data` definido y rompe una **aserción de comportamiento** es evidencia más útil que la eliminación de la guarda Zod que produce `TypeError`. Mantener separados RED informado por autor y RED reproducido por revisor.
- **H06 (P15):** hay al menos tres señales independientes que no deben confundirse: **Vercel Deployment READY**, **GitHub CI/unit success** y **`e2e-preview` status con SHA exacto y Playwright**. Solo la tercera cumple el DoD E2E.
- **Infraestructura externa:** un `403` en webhooks restringe la revisión a observación; no inferir que el webhook falta por la ausencia del status. Escalar a quien tenga acceso para verificar entregas y permisos sin revelar secretos ni disparar pruebas artificiales.
- **Policy:** el error `El PR requiere aprobación vigente de Lautaro073` es intencional hasta aprobación de P1; no crear un bypass. La aprobación vendrá luego de quitar los bloqueantes.

---

## Ronda 6 (`20de71c`)

- **P08/P15 — Frontera de privacidad:** verificar que un **payload público crudo de red** no tiene claves privadas requiere probar realmente esa superficie. Un objeto retornado por `createAdminClient().select('*')` tiene **otra autorización** y puede contener columnas legacy con valores null. Aplicarle la política de ausencia de claves da RED falso, incluso sin exposición pública.
- **Instrumentación:** cuando E2E finalmente corre, un RED real reproducible en la misma aserción 3 veces es más informativo que declarar infra fallida; revisar la línea y el origen del dato antes de cambiar RLS o test. La cobertura real de acceso T-345 pasó y no debe ser debilitada.
- **Calidad:** nunca convertir el fallo en verde con `.select('id,status,drops_count')`, `.catch()`, `.skip`, eliminación de `expect`, mocks o una respuesta artificial que omita campos. El control sustituto debe mirar la fila física íntegra, asegurar null de columnas legacy y ausencia de valores confidenciales; la API real se prueba separadamente.
- **Seguridad:** no mover la prueba a Staging, no ejecutar migraciones ni insertar datos sensibles para justificar el resultado; el gate se prueba contra Vercel Develop Preview + Supabase Develop.
