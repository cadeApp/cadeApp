import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { describe, it } from 'vitest';
import { render } from '@testing-library/react';
import { TripMerchantView } from './components/trip-merchant-view';
import { TripCourierView } from './components/trip-courier-view';
import { TripCancelDialog } from './components/trip-cancel-dialog';
import type { TripDetails } from './types';

describe('Generate visual previews', () => {
  it('renders HTML for C06, R07, and T05', () => {
    const baseTrip: TripDetails = {
      id: 'req-uuid-1',
      code: 'REQ-1234',
      status: 'matched',
      merchantId: 'merchant-1',
      merchantName: 'Kiosco Centro',
      merchantPhone: '3865222222',
      courierId: 'courier-1',
      courierName: 'Carlos Benítez',
      courierPhone: '3865111111',
      vehicleType: 'moto',
      licensePlate: 'AB 123 CD',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces',
      amountArs: 1800,
      pickupAddress: 'San Martín 450, Centro',
      pickupZoneName: 'Centro',
      dropoffAddress: 'Belgrano 1220, Aguilares',
      dropoffZoneName: 'Barrio Sur',
      deliveryNotes: 'Frente a la plaza',
      recipientName: 'Laura Gómez',
      recipientPhone: '3865123456',
      recipientPaymentMethod: 'cash',
      needsChange: true,
      cashChangeAmount: 5000,
      createdAt: '2026-09-24T10:00:00Z',
      matchedAt: '2026-09-24T10:05:00Z',
      pickedUpAt: null,
      deliveredAt: null,
    };

    const cssDir = path.resolve('.next/static/css');
    let cssContent = '';
    if (fs.existsSync(cssDir)) {
      const cssFiles = fs.readdirSync(cssDir).filter((f) => f.endsWith('.css'));
      const firstCss = cssFiles[0];
      if (firstCss) {
        cssContent = fs.readFileSync(path.join(cssDir, firstCss), 'utf-8');
      }
    }

    const evidenceDir = path.resolve('src/features/trips/evidence/T-115');
    fs.mkdirSync(evidenceDir, { recursive: true });

    function wrapHtml(title: string, componentHtml: string) {
      return `<!DOCTYPE html>
<html lang="es-AR" class="light">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
${cssContent}
  </style>
</head>
<body class="bg-background text-foreground min-h-screen antialiased">
  <div id="root">
    ${componentHtml}
  </div>
</body>
</html>`;
    }

    const c06Html = wrapHtml('C06: Viaje activo (Comercio)', ReactDOMServer.renderToString(<TripMerchantView trip={baseTrip} />));
    const r07Html = wrapHtml('R07: Viaje en curso (Repartidor)', ReactDOMServer.renderToString(<TripCourierView trip={baseTrip} />));

    const { baseElement } = render(
      <TripCancelDialog
        open={true}
        onOpenChange={() => {}}
        onConfirm={() => {}}
        defaultStep={1}
        selectedReason="Ya no hace falta"
      />
    );
    const t05Html = wrapHtml('T05: Confirmar cancelación', baseElement.innerHTML);

    fs.writeFileSync(path.join(evidenceDir, 'c06-merchant.html'), c06Html, 'utf-8');
    fs.writeFileSync(path.join(evidenceDir, 'r07-courier.html'), r07Html, 'utf-8');
    fs.writeFileSync(path.join(evidenceDir, 't05-cancel-dialog.html'), t05Html, 'utf-8');

    console.log('HTML previews generated in', evidenceDir);
  });
});
