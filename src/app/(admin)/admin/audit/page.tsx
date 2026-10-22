import {
  getAuditActors,
  getAuditLog,
  parseAdminAuditSearchParams,
} from '@/features/admin/server';
import { AuditLogTable } from '@/features/admin';

export const metadata = {
  title: 'Auditoría | cadeApp Admin',
  description: 'Registro de acciones administrativas de cadeApp',
};

interface AuditPageProps {
  searchParams: Promise<{
    cursor?: string | string[];
    actor?: string | string[];
    action?: string | string[];
    entity?: string | string[];
  }>;
}

export default async function AuditPage({ searchParams }: AuditPageProps) {
  const filters = parseAdminAuditSearchParams(await searchParams);
  const [result, actors] = await Promise.all([
    getAuditLog({ ...filters, pageSize: 20 }),
    getAuditActors(),
  ]);

  return <AuditLogTable result={result} filters={filters} actors={actors} />;
}
