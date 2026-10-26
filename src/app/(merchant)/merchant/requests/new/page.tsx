import * as React from 'react';
import { redirect } from 'next/navigation';
import { CreateRequestForm, OnlineCouriersIndicator } from '@/features/requests';
import {
  getActiveZones,
  getMerchantDefaultPickup,
  getMaxDropsPerRequest,
} from '@/features/requests/server';
import { getOnlineCouriersLiveServer } from '@/server/live/online-couriers';
import { createClient } from '@/server/supabase/server';

export default async function CanonicalNewRequestPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const [zones, defaultPickup, maxDrops, onlineCouriers] = await Promise.all([
    getActiveZones(),
    getMerchantDefaultPickup(user.id),
    getMaxDropsPerRequest(),
    getOnlineCouriersLiveServer(),
  ]);

  return (
    <div className="space-y-4 px-4 py-4">
      {/* T-415: repartidores conectados ahora, antes de completar la solicitud. */}
      <OnlineCouriersIndicator
        initial={onlineCouriers.ok ? onlineCouriers.data : null}
        className="mx-auto w-full max-w-xl"
      />
      <CreateRequestForm
        zones={zones}
        defaultPickup={defaultPickup}
        maxDrops={maxDrops}
      />
    </div>
  );
}
