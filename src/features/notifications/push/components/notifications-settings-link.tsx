import * as React from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';

export interface NotificationsSettingsLinkProps {
  href: string;
  title: string;
  description: string;
  action: string;
}

/** T-431: acceso a la configuración de avisos desde el perfil (repartidor) o la Cuenta (comercio). */
export function NotificationsSettingsLink({ href, title, description, action }: NotificationsSettingsLinkProps) {
  return (
    <Link
      href={href}
      className="flex w-full items-center justify-between rounded-xl border border-border/40 bg-card p-4 text-foreground shadow-xs transition-colors hover:bg-muted/40"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Bell className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="text-left">
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <span className="text-sm font-medium text-primary">{action}</span>
    </Link>
  );
}
