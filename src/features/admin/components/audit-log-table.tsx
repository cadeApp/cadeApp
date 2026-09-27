import type { AdminAuditFilters } from '../schemas';
import type { AuditActorOption, AuditLogResult } from '../types';

export interface AuditLogTableProps {
  readonly result: AuditLogResult;
  readonly filters: AdminAuditFilters;
  readonly actors: readonly AuditActorOption[];
}

/**
 * A06: registro de auditoría de solo lectura. Pendiente de implementación (T-123).
 */
export function AuditLogTable(_props: AuditLogTableProps) {
  return null;
}
