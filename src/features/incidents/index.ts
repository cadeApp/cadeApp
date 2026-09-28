export * from './types';
export * from './schemas';
export * from './copy';
export * from './components/report-incident-button';
export * from './components/incidents-skeleton';
// Las actions, la bandeja y el detalle admin se exportan desde `server.ts`. Si salieran por acá, toda page que importe
// este barrel —como /trips/[id]— sumaría a su bundle los Dialogs admin y lo que arrastra `@/features/auth/server`.
