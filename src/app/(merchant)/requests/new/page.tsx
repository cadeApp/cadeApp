import { redirect } from 'next/navigation';
import { CreateRequestForm } from '@/features/requests';
import { getActiveZones, getMerchantDefaultPickup } from '@/features/requests/server';
import { createClient } from '@/server/supabase/server';

export default async function NewRequestPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const [zones, defaultPickup] = await Promise.all([
    getActiveZones(),
    getMerchantDefaultPickup(user.id),
  ]);

  return (
    <main className="min-h-screen px-4 py-8 sm:py-12">
      <CreateRequestForm zones={zones} defaultPickup={defaultPickup} />
    </main>
  );
}
