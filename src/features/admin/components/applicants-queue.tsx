'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card, CardContent } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import type { AdminApplicantTab, ApplicantListItem } from '../types';

interface ApplicantsQueueProps {
  readonly initialTab: AdminApplicantTab;
  readonly applicants: readonly ApplicantListItem[];
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

export function ApplicantsQueue({ initialTab, applicants }: ApplicantsQueueProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentTab = (searchParams.get('tab') as AdminApplicantTab) || initialTab;

  function handleTabChange(tab: AdminApplicantTab) {
    const params = new URLSearchParams(searchParams);
    params.set('tab', tab);
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

      {/* Tabs accesibles con role="tablist" */}
      <div className="border-b border-border">
        <div role="tablist" aria-label="Estados de postulación" className="flex gap-2">
          {TABS_CONFIG.map((t) => {
            const isSelected = currentTab === t.id;
            return (
              <button
                key={t.id}
                role="tab"
                type="button"
                aria-selected={isSelected}
                aria-controls={`panel-${t.id}`}
                id={`tab-${t.id}`}
                onClick={() => handleTabChange(t.id)}
                className={`relative px-4 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  isSelected
                    ? 'text-primary font-semibold border-b-2 border-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tabla / Lista de Postulantes A01 */}
      <div
        id={`panel-${currentTab}`}
        role="tabpanel"
        aria-labelledby={`tab-${currentTab}`}
        className="space-y-4"
      >
        {applicants.length === 0 ? (
          <EmptyState
            title={`No hay postulantes en estado "${TABS_CONFIG.find((t) => t.id === currentTab)?.label}"`}
            description="Cuando un repartidor complete su registro o cambie de estado, aparecerá en esta lista."
          />
        ) : (
          <Card className="overflow-hidden border border-border shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm" role="table">
                <thead className="border-b border-border bg-slate-100/70 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-6 py-4">Postulante</th>
                    <th scope="col" className="px-6 py-4">Vehículo</th>
                    <th scope="col" className="px-6 py-4">Documentación</th>
                    <th scope="col" className="px-6 py-4">Nivel</th>
                    <th scope="col" className="px-6 py-4">Fecha</th>
                    <th scope="col" className="px-6 py-4 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-card">
                  {applicants.map((a) => (
                    <tr key={a.id} className="transition-colors hover:bg-slate-50/50">
                      <td className="px-6 py-4">
                        <div className="font-medium text-foreground">{a.fullName}</div>
                        <div className="text-xs text-muted-foreground">
                          DNI Hash: <span className="font-mono">{a.dniHash}</span>
                        </div>
                        {a.phone ? <div className="text-xs text-muted-foreground">{a.phone}</div> : null}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-medium">{getVehicleLabel(a.vehicleType)}</span>
                      </td>
                      <td className="px-6 py-4">
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
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-800">
                          Nivel {a.docLevel}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">
                        {new Date(a.createdAt).toLocaleDateString('es-AR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link href={`/admin/applicants/${a.id}`}>
                          <Button size="sm" variant="default" className="text-xs font-semibold">
                            Revisar
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
