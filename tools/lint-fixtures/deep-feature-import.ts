// Fixture de prueba (a): Import profundo entre features (prohibido por regla 20)
// Debe fallar con boundaries/entry-point al importar desde components en vez de index.ts o server.ts
import { ExampleCard } from '@/features/_template/components/example-card';

export function testDeepImport() {
  return ExampleCard;
}
