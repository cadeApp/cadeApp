/**
 * T-416: Zod 4 reemplazó `required_error` / `invalid_type_error` por la opción `error`. Esto conserva la semántica
 * de Zod 3: `required` solo cuando falta el valor (`undefined`) y `invalidType` para cualquier otro tipo; sin
 * `invalidType`, queda el mensaje por defecto de Zod.
 */
export function requiredError(required: string, invalidType?: string) {
  return {
    error: (issue: { input?: unknown }) => (issue.input === undefined ? required : invalidType),
  };
}
