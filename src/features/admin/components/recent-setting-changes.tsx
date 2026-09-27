import type { AuditLogItem } from '../types';

export interface RecentSettingChangesProps {
  readonly items: readonly AuditLogItem[];
}

/**
 * A04: panel «Últimos cambios» de parámetros. Pendiente de implementación (T-123).
 */
export function RecentSettingChanges(_props: RecentSettingChangesProps) {
  return null;
}
