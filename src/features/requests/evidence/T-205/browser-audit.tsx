// @vitest-environment node
import { describe, it, vi, expect } from 'vitest';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import React from 'react';
import { renderToString } from 'react-dom/server';

(globalThis as unknown as { React: typeof React }).React = React;

// Mocks para hooks de cliente durante el renderizado estático
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/ui/notify', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('@/lib/supabase/browser', () => ({
  createClient: vi.fn(() => ({
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
    removeChannel: vi.fn(),
  })),
}));

vi.mock('@/features/requests/hooks/use-request-offers', () => ({
  useRequestOffers: () => ({
    offers: [],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

vi.mock('@vis.gl/react-google-maps', () => ({
  APIProvider: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
  Map: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
  Marker: () => null,
  AdvancedMarker: () => null,
  useMap: () => null,
  useMapsLibrary: () => null,
  useApiLoadingStatus: () => 'LOADED',
  APILoadingStatus: { LOADED: 'LOADED', FAILED: 'FAILED', LOADING: 'LOADING', NOT_LOADED: 'NOT_LOADED' },
}));

// Componentes importados para SSR real
import { CreateRequestForm } from '../../components/create-request-form';
import { RequestOffersList } from '../../components/request-offers-list';
import { CourierFeed, MyOffersList } from '@/features/offers';
import { CanonicalIdentityForm as IdentityForm, CanonicalVehicleForm as VehicleForm } from '@/features/courier-onboarding';
import { TripMerchantView } from '@/features/trips';
import { TopBar } from '@/ui/top-bar';
import { Badge } from '@/ui/badge';
import { BottomNav, type BottomNavItem } from '@/ui/bottom-nav';
import { PackageSearch, BadgeDollarSign, User } from 'lucide-react';

// Estilos compilados reales
const cssPath = path.resolve('.next/static/css/b30c4bb5cec07bc0.css');
const cssContent = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : '';

// Fixtures autorizados representativos
const mockZones = [
  { id: 'zone-1', name: 'Centro', centroidLat: -27.4341, centroidLng: -65.6144 },
  { id: 'zone-2', name: 'Barrio Norte', centroidLat: -27.438, centroidLng: -65.619 },
];

const mockPickup = {
  defaultPickupAddress: 'San Martín 350',
  defaultPickupZoneId: 'zone-1',
  defaultPickupLat: -27.4341,
  defaultPickupLng: -65.6144,
  notes: null,
};

const mockRequest = {
  id: 'req-uuid-123',
  merchantId: 'merchant-1',
  pickupAddress: 'San Martín 350',
  pickupZoneId: 'zone-1',
  pickupZoneName: 'Centro',
  dropoffAddress: 'Av. Sarmiento 1200',
  dropoffZoneId: 'zone-2',
  dropoffZoneName: 'Barrio Norte',
  packageDescription: 'Documentación urgente',
  packageType: 'medium' as const,
  approxDistanceKm: '1.8',
  recipientName: 'Juan Pérez',
  recipientPhone: '3865123456',
  recipientPaymentMethod: 'cash' as const,
  needsChange: false,
  cashChangeAmount: null,
  recipientConsentDeclared: true,
  status: 'published' as const,
  createdAt: '2026-09-29T00:00:00Z',
  expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
};

const mockCourierRequests = [
  {
    id: 'req-feed-1',
    requestId: 'req-feed-1',
    pickupZoneName: 'Centro',
    dropoffZoneName: 'Barrio Norte',
    packageSize: 'medium' as const,
    packageType: 'medium' as const,
    productType: 'Comida',
    notes: null,
    publishedAt: new Date().toISOString(),
    hasMyOffer: false,
    myOfferAmountArs: null,
    recipientPaymentMethod: 'cash' as const,
    needsChange: false,
    cashChangeAmount: null,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    approxDistanceKm: '1.8',
  },
];

const mockMyOffers = [
  {
    offerId: 'offer-1',
    requestId: 'req-feed-1',
    pickupZoneName: 'Centro',
    dropoffZoneName: 'Barrio Norte',
    amountArs: 1800,
    etaMinutes: 20,
    message: null,
    status: 'pending' as const,
    createdAt: new Date().toISOString(),
    decidedAt: null,
    requestExpiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    approxDistanceKm: '1.8',
  },
];

const mockTrip = {
  id: 'req-uuid-1',
  code: 'REQ-1234',
  status: 'matched' as const,
  merchantId: 'merchant-1',
  merchantName: 'Kiosco Centro',
  merchantPhone: '3865222222',
  courierId: 'courier-1',
  courierName: 'Carlos Benítez',
  courierPhone: '3865111111',
  vehicleType: 'moto' as const,
  licensePlate: 'AB 123 CD',
  avatarUrl: 'https://signed.test/avatar.webp',
  amountArs: 1800,
  pickupAddress: 'San Martín 450, Centro',
  pickupZoneName: 'Centro',
  dropoffAddress: 'Belgrano 1220, Aguilares',
  dropoffZoneName: 'Barrio Sur',
  deliveryNotes: 'Frente a la plaza',
  recipientName: 'Laura Gómez',
  recipientPhone: '3865123456',
  recipientPaymentMethod: 'cash' as const,
  needsChange: true,
  cashChangeAmount: 5000,
  createdAt: '2026-09-24T10:00:00Z',
  matchedAt: '2026-09-24T10:05:00Z',
  pickedUpAt: null,
  deliveredAt: null,
};

// Recreación fiel de layouts canónicos
function wrapMerchant(content: React.ReactNode) {
  return (
    <div className="flex min-h-screen w-full flex-col bg-background text-foreground">
      <TopBar
        logoHref="/merchant/dashboard"
        rightAction={
          <Badge variant="published" className="px-2.5 py-0.5 text-sm font-semibold">
            Comercio
          </Badge>
        }
      />
      <main className="mx-auto w-full max-w-[390px] flex-1 pb-20 sm:max-w-2xl md:max-w-4xl lg:max-w-5xl">
        {content}
      </main>
    </div>
  );
}

function wrapCourier(content: React.ReactNode, pathname: string) {
  const showNav = !pathname.includes('/onboarding');
  const navItems: readonly BottomNavItem[] = [
    {
      id: 'feed',
      label: 'Solicitudes',
      href: '/courier/feed',
      icon: <PackageSearch className="h-5 w-5" aria-hidden="true" />,
      active: pathname === '/courier/feed',
    },
    {
      id: 'offers',
      label: 'Mis ofertas',
      href: '/courier/offers',
      icon: <BadgeDollarSign className="h-5 w-5" aria-hidden="true" />,
      active: pathname === '/courier/offers',
    },
    {
      id: 'profile',
      label: 'Perfil',
      href: '/courier/profile',
      icon: <User className="h-5 w-5" aria-hidden="true" />,
      active: pathname === '/courier/profile',
    },
  ];

  return (
    <div className="flex min-h-screen w-full flex-col bg-background text-foreground">
      <TopBar
        logoHref="/courier/feed"
        rightAction={
          <Badge variant="published" className="px-2.5 py-0.5 text-sm font-semibold">
            Repartidor
          </Badge>
        }
      />
      <main className="mx-auto w-full max-w-[390px] flex-1 pb-20 sm:max-w-2xl md:max-w-4xl lg:max-w-5xl">
        {content}
      </main>
      {showNav && <BottomNav items={navItems} />}
    </div>
  );
}

function wrapTrip(content: React.ReactNode) {
  return (
    <div className="flex min-h-screen w-full flex-col bg-background text-foreground">
      <TopBar
        logoHref="/merchant/dashboard"
        rightAction={
          <Badge variant="published" className="px-2.5 py-0.5 text-sm font-semibold">
            Viaje
          </Badge>
        }
      />
      <main className="mx-auto w-full max-w-lg space-y-4 px-4 py-4 pb-20">
        {content}
      </main>
    </div>
  );
}

function renderHtml(content: React.ReactNode, title: string) {
  const bodyHtml = renderToString(content);
  return `<!DOCTYPE html>
<html lang="es-AR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${title}</title>
  <link rel="stylesheet" href="/style.css">
  <style>
    :root {
      --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
      --font-display: 'Montserrat', system-ui, -apple-system, sans-serif;
    }
    body {
      font-family: var(--font-sans), system-ui, -apple-system, sans-serif;
      margin: 0;
      padding: 0;
      overflow-x: hidden;
    }
  </style>
</head>
<body class="font-sans antialiased min-h-screen bg-background text-foreground">
  ${bodyHtml}
</body>
</html>`;
}

// Superficies exactas de las rutas reales
const surfaces: Record<string, { html: string; targetDir: string; filePrefix: string }> = {
  '/merchant/requests/new': {
    html: renderHtml(
      wrapMerchant(
        <div className="px-4 py-4">
          <CreateRequestForm zones={mockZones} defaultPickup={mockPickup} />
        </div>
      ),
      'Crear Solicitud'
    ),
    targetDir: 'src/features/requests/evidence/T-205',
    filePrefix: 'create_request',
  },
  '/merchant/requests/req-1': {
    html: renderHtml(
      wrapMerchant(
        <div className="px-4 py-4">
          <RequestOffersList
            request={mockRequest}
            initialOffers={[]}
            initialNextCursor={null}
          />
        </div>
      ),
      'Detalle con Ofertas'
    ),
    targetDir: 'src/features/requests/evidence/T-205',
    filePrefix: 'request_offers',
  },
  '/courier/feed': {
    html: renderHtml(
      wrapCourier(
        <CourierFeed
          courierStatus="approved"
          isAvailable={true}
          requests={mockCourierRequests}
          initialNextCursor={null}
          minOfferArs={1500}
        />,
        '/courier/feed'
      ),
      'Lista del Repartidor - Feed'
    ),
    targetDir: 'src/features/offers/evidence/T-205',
    filePrefix: 'courier_feed',
  },
  '/courier/offers': {
    html: renderHtml(
      wrapCourier(<MyOffersList initialOffers={mockMyOffers} />, '/courier/offers'),
      'Lista del Repartidor - Mis Ofertas'
    ),
    targetDir: 'src/features/offers/evidence/T-205',
    filePrefix: 'my_offers',
  },
  // Árbol canónico exacto de Onboarding Identidad: sin StepIndicator duplicado externo
  '/courier/onboarding/identity': {
    html: renderHtml(
      wrapCourier(
        <div className="flex flex-col items-center justify-start px-4 py-6">
          <IdentityForm courierId="test-courier" />
        </div>,
        '/courier/onboarding/identity'
      ),
      'Onboarding Repartidor - Identidad'
    ),
    targetDir: 'src/features/courier-onboarding/evidence/T-205',
    filePrefix: 'identity_form',
  },
  // Árbol canónico exacto de Onboarding Vehículo: sin StepIndicator duplicado externo
  '/courier/onboarding/vehicle': {
    html: renderHtml(
      wrapCourier(
        <div className="flex flex-col items-center justify-start px-4 py-6">
          <VehicleForm courierId="test-courier" />
        </div>,
        '/courier/onboarding/vehicle'
      ),
      'Onboarding Repartidor - Vehículo'
    ),
    targetDir: 'src/features/courier-onboarding/evidence/T-205',
    filePrefix: 'vehicle_form',
  },
  '/trips/trip-1': {
    html: renderHtml(
      wrapTrip(
        <TripMerchantView trip={mockTrip} />
      ),
      'Viaje - Vista Comercio'
    ),
    targetDir: 'src/features/trips/evidence/T-205',
    filePrefix: 'trip_merchant',
  },
};

describe('Browser Audit & Capture Harness (T-205 / PR122-R04)', () => {
  it('detecta offenders en viewport móvil y genera capturas reales canónicas', async () => {
    const PORT = 38472;
    const server = http.createServer((req, res) => {
      const url = req.url || '/';
      if (url === '/style.css') {
        res.writeHead(200, { 'Content-Type': 'text/css' });
        res.end(cssContent);
        return;
      }
      const surface = surfaces[url];
      if (surface) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(surface.html);
        return;
      }
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    });

    await new Promise<void>((resolve) => server.listen(PORT, resolve));
    console.log(`Harness server running at http://localhost:${PORT}`);

    const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    const tmpDir = path.join(process.env.TEMP || 'C:\\temp', `edge_audit_${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    const cdpPort = 9228;
    const edgeProc = spawn(edgePath, [
      '--headless=new',
      `--remote-debugging-port=${cdpPort}`,
      `--user-data-dir=${tmpDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      '--disable-extensions',
      '--hide-scrollbars',
      'about:blank',
    ]);

    await new Promise((r) => setTimeout(r, 1500));

    try {
      const listRes = await fetch(`http://127.0.0.1:${cdpPort}/json/version`);
      const versionData = (await listRes.json()) as { Browser: string };
      console.log('Edge browser connected:', versionData.Browser);

      const viewports = [
        { name: '390x844', width: 390, height: 844 },
        { name: '360x800', width: 360, height: 800 },
      ];

      for (const [routePath, surface] of Object.entries(surfaces)) {
        for (const vp of viewports) {
          const newTabRes = await fetch(
            `http://127.0.0.1:${cdpPort}/json/new?http://localhost:${PORT}${routePath}`,
            { method: 'PUT' }
          );
          const tabData = (await newTabRes.json()) as { id: string; webSocketDebuggerUrl: string };
          const wsUrl = tabData.webSocketDebuggerUrl;

          const ws = new WebSocket(wsUrl);
          await new Promise((resolve) => (ws.onopen = resolve as () => void));

          let id = 1;
          function send(method: string, params: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
            return new Promise((resolve, reject) => {
              const currentId = id++;
              const handler = (event: MessageEvent) => {
                const msg = JSON.parse(event.data as string) as {
                  id: number;
                  error?: unknown;
                  result: Record<string, unknown>;
                };
                if (msg.id === currentId) {
                  ws.removeEventListener('message', handler as (event: Event) => void);
                  if (msg.error) reject(msg.error);
                  else resolve(msg.result);
                }
              };
              ws.addEventListener('message', handler as (event: Event) => void);
              ws.send(JSON.stringify({ id: currentId, method, params }));
            });
          }

          await send('Page.enable');
          await send('Runtime.enable');

          await send('Emulation.setDeviceMetricsOverride', {
            width: vp.width,
            height: vp.height,
            deviceScaleFactor: 1,
            mobile: true,
            screenWidth: vp.width,
            screenHeight: vp.height,
            screenOrientation: { type: 'portraitPrimary', angle: 0 },
          });

          await new Promise((r) => setTimeout(r, 600));

          // Detector de elementos desbordantes
          const evalResult = await send('Runtime.evaluate', {
            expression: `(() => {
              const offenders = [];
              const allEls = document.querySelectorAll('*');
              for (const el of allEls) {
                const rect = el.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                  if (rect.right > window.innerWidth + 1 || rect.left < -1) {
                    offenders.push({
                      tag: el.tagName,
                      id: el.id,
                      className: (el.className || '').toString().slice(0, 50),
                      left: Math.round(rect.left),
                      right: Math.round(rect.right),
                      width: Math.round(rect.width),
                      innerWidth: window.innerWidth,
                    });
                  }
                }
              }
              return {
                innerWidth: window.innerWidth,
                rootScrollWidth: document.documentElement.scrollWidth,
                bodyScrollWidth: document.body.scrollWidth,
                bodyOverflowX: getComputedStyle(document.body).overflowX,
                offendersCount: offenders.length,
                offenders: offenders.slice(0, 10),
              };
            })()`,
            returnByValue: true,
          });

          const auditData = (evalResult.result as { value: {
            innerWidth: number;
            rootScrollWidth: number;
            bodyScrollWidth: number;
            bodyOverflowX: string;
            offendersCount: number;
            offenders: unknown[];
          } }).value;

          console.log(
            `[AUDIT] ${routePath} @ ${vp.name}: innerWidth=${auditData.innerWidth}, rootScroll=${auditData.rootScrollWidth}, bodyScroll=${auditData.bodyScrollWidth}, offenders=${auditData.offendersCount}`
          );

          expect(auditData.offendersCount).toBe(0);

          // Capturar screenshot directamente desde CDP
          const screenshotResult = await send('Page.captureScreenshot', {
            format: 'png',
            captureBeyondViewport: false,
          });

          const base64Data = (screenshotResult as { data: string }).data;
          const imgBuffer = Buffer.from(base64Data, 'base64');

          const outPath = path.resolve(surface.targetDir, `${surface.filePrefix}_${vp.name}.png`);
          fs.writeFileSync(outPath, imgBuffer);

          ws.close();
          await fetch(`http://127.0.0.1:${cdpPort}/json/close/${tabData.id}`);
        }
      }
    } finally {
      edgeProc.kill();
      server.close();
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        // Ignorar cleanup de temp
      }
    }
  });
});
