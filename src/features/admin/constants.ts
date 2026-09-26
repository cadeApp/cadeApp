import { ADMIN_COPY } from './copy';

export const ADMIN_NAV_TABS = [
  { label: ADMIN_COPY.nav.tabs.applicants, href: '/admin/applicants' },
  { label: ADMIN_COPY.nav.tabs.merchants, href: '/admin/merchants' },
  { label: ADMIN_COPY.nav.tabs.incidents, href: '/admin/incidents' },
  { label: ADMIN_COPY.nav.tabs.settings, href: '/admin/settings' },
  { label: ADMIN_COPY.nav.tabs.audit, href: '/admin/audit' },
] as const;
