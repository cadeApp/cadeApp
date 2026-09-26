'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/ui/tabs';
import type { AdminApplicantTab, ApplicantListItem } from '../types';

export interface ApplicantsQueueProps {
  readonly initialTab: AdminApplicantTab;
  readonly applicants: readonly ApplicantListItem[];
  readonly page?: number;
  readonly pageSize?: number;
  readonly totalCount?: number;
  readonly totalPages?: number;
}

const TABS_CONFIG: Array<{ id: AdminApplicantTab; label: string }> = [
  { id: 'pending', label: 'Pendientes' },
  { id: 'approved', label: 'Aprobados' },
  { id: 'rejected', label: 'Rechazados' },
  { id: 'suspended', label: 'Suspendidos' },
];

function getVehicleLabel(type: string): string {
  switch (type) {
    case 'moto':
      return 'Moto';
    case 'bike':
      return 'Bicicleta';
    case 'auto':
    case 'car':
      return 'Automóvil';
    case 'walk':
      return 'A pie';
    default:
      return type;
  }
}

export function ApplicantsQueue({
  initialTab,
  applicants,
  page = 1,
  pageSize = 20,
  totalCount = 0,
  totalPages = 1,
}: ApplicantsQueueProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentTab = initialTab;

  function handleTabChange(tab: AdminApplicantTab) {
    const params = new URLSearchParams(searchParams);
    params.set('tab', tab);
    params.delete('page');
    router.push(`/admin/applicants?${params.toString()}`);
  }

  function handlePageChange(newPage: number) {
    const params = new URLSearchParams(searchParams);
    params.set('page', String(newPage));
    router.push(`/admin/applicants?${params.toString()}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Postulantes</h1>
          <p className="text-sm text-muted-foreground">
            Bandeja de verificación de documentación y aprobación de repartidores en Aguilares.
          </p>
        </div>
      </div>

      <Tabs
        value={currentTab}
        onValueChange={(val) => handleTabChange(val as AdminApplicantTab)}
        className="w-full space-y-4"
      >
        <div className="border-b border-border">
          <TabsList className="h-auto p-0 bg-transparent gap-2">
            {TABS_CONFIG.map((t) => (
              <TabsTrigger
                key={t.id}
                value={t.id}
                className="relative px-4 py-3 text-sm font-medium rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none data-[state=active]:bg-transparent"
              >
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value={currentTab} className="mt-0 space-y-4">
          {applicants.length === 0 ? (
            <EmptyState
              title={`No hay postulantes en estado "${TABS_CONFIG.find((t) => t.id === currentTab)?.label}"`}
              description="Cuando un repartidor complete su registro o cambie de estado, aparecerá en esta lista."
            />
          ) : (
            <Card className="overflow-hidden border border-border shadow-sm">
              <Table>
                <TableHeader className="bg-slate-100/70">
                  <TableRow>
                    <TableHead className="px-6 py-4 font-semibold uppercase tracking-wider text-muted-foreground text-sm">
                      Postulante
                    </TableHead>
                    <TableHead className="px-6 py-4 font-semibold uppercase tracking-wider text-muted-foreground text-sm">
                      Vehículo
                    </TableHead>
                    <TableHead className="px-6 py-4 font-semibold uppercase tracking-wider text-muted-foreground text-sm">
                      Documentación
                    </TableHead>
                    <TableHead className="px-6 py-4 font-semibold uppercase tracking-wider text-muted-foreground text-sm">
                      Nivel
                    </TableHead>
                    <TableHead className="px-6 py-4 font-semibold uppercase tracking-wider text-muted-foreground text-sm">
                      Fecha
                    </TableHead>
                    <TableHead className="px-6 py-4 text-right font-semibold uppercase tracking-wider text-muted-foreground text-sm">
                      Acción
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="bg-card">
                  {applicants.map((a) => (
                    <TableRow key={a.id} className="transition-colors hover:bg-slate-50/50">
                      <TableCell className="px-6 py-4">
                        <div className="font-medium text-foreground text-sm">{a.fullName}</div>
                        <div className="text-sm text-muted-foreground">
                          DNI Hash: <span className="font-mono">{a.dniHash}</span>
                        </div>
                        {a.phone ? <div className="text-sm text-muted-foreground">{a.phone}</div> : null}
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <span className="font-medium text-sm">{getVehicleLabel(a.vehicleType)}</span>
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          <Badge variant={a.documentsSummary.hasDniFront && a.documentsSummary.hasDniBack ? 'secondary' : 'outline'}>
                            DNI {a.documentsSummary.hasDniFront && a.documentsSummary.hasDniBack ? '✓' : '—'}
                          </Badge>
                          <Badge variant={a.documentsSummary.hasSelfie ? 'secondary' : 'outline'}>
                            Selfie {a.documentsSummary.hasSelfie ? '✓' : '—'}
                          </Badge>
                          {a.documentsSummary.hasLicense ? (
                            <Badge variant={a.licenseStatus === 'verified' ? 'default' : 'secondary'}>
                              Licencia {a.licenseStatus === 'verified' ? '✓' : 'subida'}
                            </Badge>
                          ) : null}
                          {a.documentsSummary.hasInsurance ? (
                            <Badge variant={a.insuranceStatus === 'verified' ? 'default' : 'secondary'}>
                              Seguro {a.insuranceStatus === 'verified' ? '✓' : 'subido'}
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 text-sm font-semibold text-slate-800">
                          Nivel {a.docLevel}
                        </span>
                      </TableCell>
                      <TableCell className="px-6 py-4 text-muted-foreground whitespace-nowrap text-sm">
                        {new Date(a.createdAt).toLocaleDateString('es-AR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-right">
                        <Link href={`/admin/applicants/${a.id}`}>
                          <Button size="sm" variant="default" className="text-sm font-semibold">
                            Revisar
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}

          {totalPages > 1 ? (
            <div className="flex items-center justify-between px-2 pt-2">
              <p className="text-sm text-muted-foreground">
                Página {page} de {totalPages} ({totalCount} postulantes)
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => handlePageChange(page - 1)}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => handlePageChange(page + 1)}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
