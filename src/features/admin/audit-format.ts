import { formatArs, formatDate } from '@/lib/format';
import { ADMIN_COPY } from './copy';
import type { AuditChange, AuditChangeValue, AuditLogItem } from './types';

const CIVIL_DATE = /^\d{4}-\d{2}-\d{2}$/;

function lookup<T extends Record<string, string>>(labels: T, key: string): string | undefined {
  return Object.prototype.hasOwnProperty.call(labels, key) ? labels[key as keyof T] : undefined;
}

/** Fecha civil `YYYY-MM-DD` en formato local, sin corrimiento por zona horaria. */
export function formatCivilDate(value: string): string {
  return formatDate(`${value}T12:00:00-03:00`, 'date');
}

export function auditActionLabel(action: string): string {
  return lookup(ADMIN_COPY.audit.actions, action) ?? ADMIN_COPY.audit.unknownAction;
}

/** T-407: tono de la etiqueta de acción en A06. El texto siempre acompaña: el color nunca es la única señal. */
export type AuditActionTone = 'positive' | 'negative' | 'neutral' | 'access';

const ACTION_TONES: Readonly<Record<string, AuditActionTone>> = {
  view_courier_document: 'access',
  admin_reinstate_courier: 'positive',
  courier_dni_released: 'neutral',
  admin_grant_publication_credits: 'positive',
  mark_delivered: 'positive',
  admin_suspend_courier: 'negative',
  cancel_request: 'negative',
  courier_cancel_match: 'negative',
  report_no_show: 'negative',
  expired: 'negative',
  legacy_migration_inconsistent: 'negative',
  orphan_storage_object_purged: 'negative',
};

/** Decisiones cuyo tono depende del estado al que llevaron (aprobó, rechazó, resolvió o desestimó). */
const STATUS_TONES: Readonly<Record<string, AuditActionTone>> = {
  approved: 'positive',
  verified: 'positive',
  rejected: 'negative',
  suspended: 'negative',
  resolved: 'positive',
  dismissed: 'neutral',
};

const STATUS_DRIVEN_ACTIONS: ReadonlySet<string> = new Set([
  'admin_decide_courier',
  'admin_verify_document',
  'admin_resolve_incident',
]);

function toneOf(tones: Readonly<Record<string, AuditActionTone>>, key: string): AuditActionTone {
  return Object.prototype.hasOwnProperty.call(tones, key) ? (tones[key] ?? 'neutral') : 'neutral';
}

export function auditActionTone(item: Pick<AuditLogItem, 'action' | 'changes'>): AuditActionTone {
  if (STATUS_DRIVEN_ACTIONS.has(item.action)) {
    const status = item.changes.find((change) => change.field === 'status')?.after;
    return typeof status === 'string' ? toneOf(STATUS_TONES, status) : 'neutral';
  }
  return toneOf(ACTION_TONES, item.action);
}

export function auditEntityLabel(targetType: string): string {
  return lookup(ADMIN_COPY.audit.entities, targetType) ?? ADMIN_COPY.audit.unknownEntity;
}

export function auditFieldLabel(field: string): string {
  return lookup(ADMIN_COPY.audit.fields, field) ?? field;
}

/** Nombre amigable de un parámetro de plataforma; si no se conoce, su clave. */
export function settingLabel(key: string): string {
  const fields = ADMIN_COPY.settings.fields;
  return Object.prototype.hasOwnProperty.call(fields, key)
    ? fields[key as keyof typeof fields].label
    : key;
}

/** Referencia legible de la entidad afectada. */
export function auditTargetLabel(
  item: Pick<AuditLogItem, 'targetType' | 'targetRef' | 'targetName'>
): string {
  if (item.targetType === 'platform_setting') return settingLabel(item.targetRef);
  return item.targetName ?? item.targetRef;
}

export type AuditChangeDisplay =
  { readonly before: string; readonly after: string } | { readonly value: string };

/**
 * T-400: un campo de un solo lado (o igual en los dos) es un dato o contexto, no un cambio «→ —».
 */
export function describeAuditChange(
  item: Pick<AuditLogItem, 'targetType' | 'targetRef'>,
  change: AuditChange
): AuditChangeDisplay {
  const { before, after } = change;
  if (before !== undefined && after !== undefined && before !== after) {
    return {
      before: formatAuditValue(item, change.field, before),
      after: formatAuditValue(item, change.field, after),
    };
  }
  return { value: formatAuditValue(item, change.field, after ?? before ?? null) };
}

export function formatAuditValue(
  item: Pick<AuditLogItem, 'targetType' | 'targetRef'>,
  field: AuditChange['field'],
  value: AuditChangeValue
): string {
  if (value === null) {
    return ADMIN_COPY.audit.noValue;
  }
  if (typeof value === 'boolean') {
    if (field === 'dni_registered') {
      return value ? ADMIN_COPY.audit.dniRegisteredYes : ADMIN_COPY.audit.dniRegisteredNo;
    }
    return value ? ADMIN_COPY.settings.pilotOn : ADMIN_COPY.settings.pilotOff;
  }
  if (typeof value === 'number') {
    const isOfferFloor =
      item.targetType === 'platform_setting' && item.targetRef === 'min_offer_ars';
    return isOfferFloor && Number.isInteger(value) && value >= 0 ? formatArs(value) : String(value);
  }
  if (field === 'paid_until' && CIVIL_DATE.test(value)) {
    return formatCivilDate(value);
  }
  if (field === 'kind') {
    return lookup(ADMIN_COPY.documentKind, value) ?? value;
  }
  if (field === 'status' || field === 'subscription_status') {
    return lookup(ADMIN_COPY.audit.values, value) ?? value;
  }
  return value;
}
