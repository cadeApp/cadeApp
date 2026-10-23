import { ADMIN_COPY } from './copy';

export const ADMIN_NAV_TABS = [
  { label: ADMIN_COPY.nav.tabs.applicants, href: '/admin/applicants' },
  { label: ADMIN_COPY.nav.tabs.merchants, href: '/admin/merchants' },
  // T-410: sección «Viajes» entre Comercios e Incidentes.
  { label: ADMIN_COPY.nav.tabs.trips, href: '/admin/trips' },
  { label: ADMIN_COPY.nav.tabs.incidents, href: '/admin/incidents' },
  // T-414: novedades y promociones para comercios y repartidores.
  { label: ADMIN_COPY.nav.tabs.announcements, href: '/admin/announcements' },
  { label: ADMIN_COPY.nav.tabs.settings, href: '/admin/settings' },
  { label: ADMIN_COPY.nav.tabs.audit, href: '/admin/audit' },
] as const;
