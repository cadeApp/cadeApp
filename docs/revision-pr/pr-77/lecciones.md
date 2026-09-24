# Lecciones — PR #77 (T-121)

Numeración continua del proyecto. `AG-01`…`AG-63` están en las carpetas de las PRs anteriores.

---

## `AG-64` · Mocks declarados en el setup de un test deben ser asertados al final, o la prueba pasa con la funcionalidad omitida

**Origen:** `PR77-H03` (pariente de `P08-control-no-cubre-lo-que-dice`)

En `src/features/courier-onboarding/actions.test.ts`, el test de éxito de onboarding configura el mock de Supabase creando espías específicos para las tablas secundarias involucradas en la persistencia del flujo:

```ts
const mockInsertConsents = vi.fn().mockResolvedValue({ error: null });
const mockUpsertDocuments = vi.fn().mockResolvedValue({ error: null });
```

Estos mocks se conectan en el despachador de tablas (`from('consents')`, `from('courier_documents')`). Sin embargo, en el bloque final de aserciones:

```ts
expect(result.ok).toBe(true);
expect(mockUpdateCourier).toHaveBeenCalled();
```

**Ni `mockInsertConsents` ni `mockUpsertDocuments` son verificados.**

Consecuencia directa: si la Server Action omite por completo registrar los consentimientos legales en la tabla `consents` o guardar los documentos en `courier_documents`, **la prueba pasa en verde sin inmutarse**. El control mide un proxy incompleto (que la llamada retorna éxito y que se tocó la tabla de couriers), dejando desprotegidos los invariantes probatorios y de auditoría de la plataforma.

> **Regla propuesta.** Todo espía o mock creado para registrar efectos colaterales de persistencia (inserciones en `consents`, `audit_log`, `courier_documents`, notificaciones) debe tener **al menos una aserción explícita `expect(spy).toHaveBeenCalledWith(...)`** que valide no solo la invocación sino los campos críticos (IDs de usuario, tipos, payloads). Mocks de escritura declarados en el setup que no son asertados en el desenlace del test deben tratarse como olores de código y ser observados en revisión.

---

## `AG-65` · Pruebas de utilidades de cliente (Canvas / DOM / File) requieren configuración explícita de entorno y mocks de APIs ausentes en Node

**Origen:** `PR77-H04` (pariente de `P01-contrato-de-framework-no-verificado`)

`image-compression.test.ts` define pruebas unitarias para `compressImage(file)` asumiendo la ejecución de compresión nativa basada en Canvas (`HTMLCanvasElement`, `createImageBitmap`, `OffscreenCanvas`). Sin embargo, el archivo se ejecuta en el entorno por defecto `node` de Vitest sin la directiva `// @vitest-environment jsdom`.

En un entorno puro de Node.js, `document`, `HTMLCanvasElement` y las APIs de imagen son inexistentes. E incluso dentro de `jsdom`, `canvas.getContext('2d')` devuelve `null` por defecto salvo que se mockeen sus métodos o se use una librería de soporte.

Escribir tests en fase roja asumiendo la disponibilidad global de APIs de navegador en Node sin configurar el entorno de ejecución provoca que, al implementarse el código de producción, la suite falle de inmediato con errores de runtime (`ReferenceError: document is not defined`) no atribuibles a la lógica de negocio.

> **Regla propuesta.** Todo archivo de prueba que ejerza código cliente dependiente del DOM, Canvas, Storage de navegador o APIs de ventana debe declarar en su primera línea `// @vitest-environment jsdom` y establecer los mocks necesarios para los métodos no implementados por el simulador de DOM antes de escribir la suite.
