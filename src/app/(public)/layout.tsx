import * as React from 'react';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-[390px] flex-col bg-background text-foreground">
      {children}
    </div>
  );
}
