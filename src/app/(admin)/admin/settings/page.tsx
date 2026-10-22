import { getPlatformSettings, getRecentSettingChanges } from '@/features/admin/server';
import { ADMIN_COPY, PlatformSettingsForm, RecentSettingChanges } from '@/features/admin';

export const metadata = {
  title: 'Parámetros | cadeApp Admin',
  description: 'Configuración operativa de cadeApp en Aguilares',
};

export default async function SettingsPage() {
  const [settings, recentChanges] = await Promise.all([
    getPlatformSettings(),
    getRecentSettingChanges(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {ADMIN_COPY.settings.title}
        </h1>
        <p className="text-sm text-muted-foreground">{ADMIN_COPY.settings.description}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PlatformSettingsForm settings={settings} />
        </div>
        <aside>
          <RecentSettingChanges items={recentChanges} />
        </aside>
      </div>
    </div>
  );
}
