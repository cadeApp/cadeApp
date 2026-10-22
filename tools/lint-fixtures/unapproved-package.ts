// Fixture de prueba (c): Paquete fuera de la lista aprobada (prohibido por regla 25)
// Debe fallar con no-restricted-imports
import axios from 'axios';

export function fetchSomething() {
  return axios.get('https://example.com');
}
