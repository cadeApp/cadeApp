import { redirect } from 'next/navigation';
import { CreateRequestForm } from '@/features/requests';
import {
  getActiveZones,
  getMerchantDefaultPickup,
  getMaxDropsPerRequest,
} from '@/features/requests/server';
import { createClient } from '@/server/supabase/server';

export default async function CanonicalNewRequestPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const [zones, defaultPickup, maxDrops] = await Promise.all([
    getActiveZones(),
    getMerchantDefaultPickup(user.id),
    getMaxDropsPerRequest(),
  ]);

  return (
    <div className="px-4 py-4">
      <CreateRequestForm
        zones={zones}
        defaultPickup={defaultPickup}
        maxDrops={maxDrops}
      />
    </div>
  );
}
