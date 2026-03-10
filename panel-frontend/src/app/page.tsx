'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import type { App, AppsResponse, AppResponse, DeployPayload } from '@/lib/types';

import Sidebar from '@/components/Sidebar';
import StatsBar from '@/components/StatsBar';
import AppGrid from '@/components/AppGrid';
import DeployModal from '@/components/DeployModal';
import LogsModal from '@/components/LogsModal';
import EnvModal from '@/components/EnvModal';
import AuthGate from '@/components/AuthGate';

export default function DashboardPage() {
  const [authed, setAuthed] = useState(false);
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deployOpen, setDeployOpen] = useState(false);
  const [logsApp, setLogsApp] = useState<string | null>(null);
  const [envApp, setEnvApp] = useState<string | null>(null);

  const loadApps = useCallback(async () => {
    try {
      const data = await apiFetch<AppsResponse>('/api/apps');
      setApps(data.apps || []);
    } catch (e: unknown) {
      if (e instanceof Error) toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('hp_token');
    if (token) {
      setAuthed(true);
      loadApps();
      const interval = setInterval(loadApps, 30_000);
      return () => clearInterval(interval);
    }
  }, [loadApps]);

  const handleAuthSuccess = () => {
    setAuthed(true);
    loadApps();
  };

  const handleDeploy = async (payload: DeployPayload) => {
    try {
      const res = await apiFetch<AppResponse>('/api/apps', { method: 'POST', body: JSON.stringify(payload) });
      toast.success(`App "${payload.name}" created! Triggering deploy...`);
      await apiFetch(`/api/apps/${res.app.slug}/deploy`, { method: 'POST' });
      setDeployOpen(false);
      setTimeout(loadApps, 1500);
    } catch (e: unknown) {
      if (e instanceof Error) toast.error(e.message);
    }
  };

  const handleRedeploy = async (slug: string) => {
    try {
      await apiFetch(`/api/apps/${slug}/deploy`, { method: 'POST' });
      toast.success(`Deploy triggered for "${slug}"`);
      setApps(prev => prev.map(a => a.slug === slug ? { ...a, status: 'deploying' } : a));
      // Poll for completion
      const poll = async (attempts = 0): Promise<void> => {
        if (attempts > 60) return;
        await new Promise(r => setTimeout(r, 5000));
        try {
          const data = await apiFetch<AppResponse>(`/api/apps/${slug}`);
          if (data.app.status === 'deploying') return poll(attempts + 1);
          loadApps();
          if (data.app.status === 'running') toast.success(`"${slug}" deployed successfully ✓`);
          else toast.error(`"${slug}" deploy finished with status: ${data.app.status}`);
        } catch { /* ignore */ }
      };
      poll();
    } catch (e: unknown) {
      if (e instanceof Error) toast.error(e.message);
    }
  };

  const handleDelete = async (slug: string) => {
    try {
      await apiFetch(`/api/apps/${slug}`, { method: 'DELETE' });
      toast.success(`App "${slug}" deleted`);
      loadApps();
    } catch (e: unknown) {
      if (e instanceof Error) toast.error(e.message);
    }
  };

  const handleSSL = async (slug: string) => {
    try {
      toast.info(`Provisioning SSL for "${slug}"...`);
      await apiFetch(`/api/apps/${slug}/ssl`, { method: 'POST' });
      toast.success(`SSL provisioned for "${slug}" ✓`);
      loadApps();
    } catch (e: unknown) {
      if (e instanceof Error) toast.error(e.message);
    }
  };

  const filtered = apps.filter(a =>
    a.name?.toLowerCase().includes(search.toLowerCase()) ||
    a.slug?.toLowerCase().includes(search.toLowerCase()) ||
    a.domain?.toLowerCase().includes(search.toLowerCase())
  );

  if (!authed) return <AuthGate onSuccess={handleAuthSuccess} />;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar onNewApp={() => setDeployOpen(true)} />

      <main className="flex-1 flex flex-col min-h-screen lg:pl-64">
        <div className="p-6 space-y-6">
          <StatsBar apps={apps} />

          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold text-foreground">Applications</h2>
            <input
              type="text"
              placeholder="Search apps…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="px-3 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring w-64"
            />
          </div>

          <AppGrid
            apps={filtered}
            loading={loading}
            onDeploy={handleRedeploy}
            onLogs={slug => setLogsApp(slug)}
            onEnv={slug => setEnvApp(slug)}
            onSSL={handleSSL}
            onDelete={handleDelete}
            onNewApp={() => setDeployOpen(true)}
          />
        </div>
      </main>

      <DeployModal
        open={deployOpen}
        onClose={() => setDeployOpen(false)}
        onDeploy={handleDeploy}
      />
      <LogsModal
        slug={logsApp}
        onClose={() => setLogsApp(null)}
      />
      <EnvModal
        slug={envApp}
        onClose={() => setEnvApp(null)}
      />
    </div>
  );
}
