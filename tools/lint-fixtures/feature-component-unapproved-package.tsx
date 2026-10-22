// Fixture de prueba: un componente de feature no puede importar paquetes prohibidos como axios (R1)
// Debe fallar con no-restricted-imports
import axios from 'axios';

export function ComponentWithUnapprovedPackage() {
  return typeof axios;
}
