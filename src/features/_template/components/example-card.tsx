import { cn } from '@/ui/cn';
import type { ExampleItem } from '../schemas';

export interface ExampleCardProps {
  item: ExampleItem;
  className?: string;
}

export function ExampleCard({ item, className }: ExampleCardProps) {
  return (
    <div className={cn('rounded-xl border bg-card p-4 shadow-sm text-foreground', className)}>
      <h3 className="font-semibold text-base">{item.name}</h3>
      <p className="text-xs text-muted-foreground mt-1">ID: {item.id}</p>
    </div>
  );
}
