import { Card, CardContent } from '@/components/ui/card';
import type { App } from '@/lib/types';

interface StatsBarProps { apps: App[] }

export default function StatsBar({ apps }: StatsBarProps) {
  const stats = [
    { label: 'Total Apps', value: apps.length, icon: '📦' },
    { label: 'Running',    value: apps.filter(a => a.status === 'running').length,  icon: '🟢' },
    { label: 'Errors',     value: apps.filter(a => a.status === 'error').length,    icon: '🔴' },
    { label: 'Laravel',    value: apps.filter(a => a.type === 'laravel').length,    icon: '🐘' },
    { label: 'Next.js',    value: apps.filter(a => a.type === 'nextjs').length,     icon: '⬡' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {stats.map(s => (
        <Card key={s.label} className="bg-card border-border">
          <CardContent className="p-4">
            <div className="text-2xl mb-1">{s.icon}</div>
            <div className="text-2xl font-bold text-foreground">{s.value}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
