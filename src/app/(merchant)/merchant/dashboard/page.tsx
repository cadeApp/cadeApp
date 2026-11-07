import * as React from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/server/supabase/server';
import { getMerchantRequests } from '@/features/requests/server';
import { MerchantRequestsList, OnlineCouriersIndicator } from '@/features/requests';
import { AnnouncementBanner } from '@/features/announcements';
import { getMyAnnouncement } from '@/features/announcements/server';
import { getOnlineCouriersLiveServer } from '@/server/live/online-couriers';

export default async function MerchantDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    throw new Error(`Error de autenticación: ${authError.message}`);
  }

  if (!user) {
    redirect('/login');
  }

  // Verificar si el comercio existe usando las columnas reales del esquema (profile_id, business_name)
  const { data: merchantProfile, error: merchantError } = await supabase
    .from('merchants')
    .select('profile_id, business_name')
    .eq('profile_id', user.id)
    .maybeSingle<{ profile_id: string; business_name: string }>();

  if (merchantError) {
    throw new Error(`Error al consultar perfil del comercio: ${merchantError.message}`);
  }

  // T-334: la fila la crea handle_new_user al registrarse; el onboarding está completo solo con business_name.
  if (!merchantProfile || merchantProfile.business_name.trim() === '') {
    redirect('/merchant/onboarding');
  }

  const [{ requests, metrics }, announcement, onlineCouriers] = await Promise.all([
    getMerchantRequests(merchantProfile.profile_id),
    getMyAnnouncement(),
    getOnlineCouriersLiveServer(),
  ]);

  return (
    <div className="space-y-4 px-4 py-4">
      {/* T-414: la novedad vigente va antes de las solicitudes. */}
      {announcement ? <AnnouncementBanner key={announcement.id} announcement={announcement} /> : null}
      {/* T-415 (diseño T-417): repartidores conectados ahora, como una métrica más. */}
      <MerchantRequestsList
        requests={requests}
        metrics={metrics}
        extraMetric={<OnlineCouriersIndicator initial={onlineCouriers.ok ? onlineCouriers.data : null} />}
      />
    </div>
  );
}
