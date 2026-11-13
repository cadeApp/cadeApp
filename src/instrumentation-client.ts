import { z } from 'zod';

// T-436 (D5-C): Zod decide si usa JIT al construir cada `z.object`, y la sonda `new Function("")` choca con la CSP
// forzada (sin 'unsafe-eval'). Next carga este archivo antes que cualquier módulo de la app en el cliente, así que
// ningún esquema se construye antes de esta línea.
z.config({ jitless: true });
