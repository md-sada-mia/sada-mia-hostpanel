'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { App, AppStatus } from '@/lib/types';
import { format } from 'date-fns';

interface AppGridProps {
  apps: App[];
  loading: boolean;
  onDeploy: (slug: string) => void;
  onLogs: (slug: string) => void;
  onEnv: (slug: string) => void;
  onSSL: (slug: string) => void;
  onDelete: (slug: string) => void;
  onNewApp: () => void;
}

function statusVariant(s: AppStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (s === 'running') return 'default';
  if (s === 'error') return 'destructive';
  if (s === 'deploying') return 'secondary';
  return 'outline';
}

function statusLabel(s: AppStatus) {
  return { running: '● Running', error: '✕ Error', deploying: '⟳ Deploying…', pending: '○ Pending', stopped: '■ Stopped' }[s] ?? s;
}

export default function AppGrid({ apps, loading, onDeploy, onLogs, onEnv, onSSL, onDelete, onNewApp }: AppGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="border-border bg-card">
            <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-4 w-60" />
              <Skeleton className="h-4 w-32" />
            </CardContent>
            <CardFooter><Skeleton className="h-8 w-full" /></CardFooter>
          </Card>
        ))}
      </div>
    );
  }

  if (!apps.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-24 text-center">
        <div className="text-5xl mb-4">🚀</div>
        <h3 className="text-lg font-semibold text-foreground">No applications</h3>
        <p className="text-muted-foreground text-sm mt-1 mb-6">Click <strong>+ New App</strong> to deploy your first application.</p>
        <Button onClick={onNewApp}>＋ New App</Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
      {apps.map(app => (
        <Card key={app.slug} className="flex flex-col border-border bg-card hover:border-primary/40 transition-colors">
          {/* Header */}
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-semibold text-foreground truncate">{app.name || app.slug}</div>
                <a
                  href={`http://${app.domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  🌐 {app.domain}
                </a>
              </div>
              <Badge variant="outline" className="shrink-0 text-xs">
                {app.type === 'laravel' ? '🐘 Laravel' : '⬡ Next.js'}
              </Badge>
            </div>
          </CardHeader>

          {/* Status & meta */}
          <CardContent className="flex-1 space-y-2 pb-4">
            <div className="flex items-center justify-between">
              <Badge variant={statusVariant(app.status)} className="text-xs font-mono">
                {statusLabel(app.status)}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {app.lastDeploy ? format(new Date(app.lastDeploy), 'MMM d, HH:mm') : 'Never'}
              </span>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {app.port && <span>🔌 :{app.port}</span>}
              {app.dbName && <span>🗄 {app.dbName}</span>}
              <span>{app.sslEnabled ? '🔒 SSL' : '🔓 No SSL'}</span>
            </div>
          </CardContent>

          {/* Actions */}
          <CardFooter className="flex flex-wrap gap-2 border-t border-border pt-3">
            <Button size="sm" onClick={() => onDeploy(app.slug)} className="flex-1">▶ Deploy</Button>
            <Button size="sm" variant="outline" onClick={() => onLogs(app.slug)}>📋 Logs</Button>
            <Button size="sm" variant="outline" onClick={() => onEnv(app.slug)}>⚙ Env</Button>
            {!app.sslEnabled && (
              <Button size="sm" variant="outline" onClick={() => onSSL(app.slug)}>🔒 SSL</Button>
            )}
            <Button size="sm" variant="destructive" onClick={() => {
              if (confirm(`Delete "${app.slug}"? This is irreversible.`)) onDelete(app.slug);
            }}>✕</Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
