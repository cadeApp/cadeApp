// Fixture: Import de subruta de paquete no aprobado (Hallazgo 5)
// Debe fallar con no-restricted-imports
import get from 'lodash/get';

export function testLodashSubpath(obj: Record<string, unknown>) {
  return get(obj, 'a.b');
}
