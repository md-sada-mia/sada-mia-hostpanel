'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Settings {
  githubClientId?: string;
  hasGithubSecret?: boolean;
  hasGithubToken?: boolean;
  adminEmail?: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({});
  const [token, setToken] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem('hp_token') || '';
    setToken(t);
    apiFetch<Settings>('/api/settings').then(setSettings).catch(() => {});
  }, []);

  const saveToken = () => {
    localStorage.setItem('hp_token', token);
    toast.success('API token saved!');
  };

  const saveGitHub = async () => {
    setLoading(true);
    try {
      await apiFetch('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({ githubClientId: clientId, githubClientSecret: clientSecret }),
      });
      toast.success('GitHub App keys saved!');
      setClientSecret('');
      const updated = await apiFetch<Settings>('/api/settings');
      setSettings(updated);
    } catch (e: unknown) {
      if (e instanceof Error) toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const connectGitHub = async () => {
    try {
      const data = await apiFetch<{ url: string }>('/api/github/auth');
      if (data.url) window.location.href = data.url;
    } catch (e: unknown) {
      if (e instanceof Error) toast.error(e.message);
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar onNewApp={() => {}} />
      <main className="flex-1 p-6 lg:pl-72 space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>

        {/* Auth */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base">API Authentication</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Your API secret is stored in browser localStorage.</p>
            <div className="flex gap-3">
              <Input
                type="password"
                placeholder="PANEL_SECRET"
                value={token}
                onChange={e => setToken(e.target.value)}
                className="max-w-sm"
              />
              <Button onClick={saveToken}>Save</Button>
            </div>
          </CardContent>
        </Card>

        {/* GitHub */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base">GitHub Integration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Connect HostPanel to your GitHub account to deploy repos without pasting URLs.
            </p>
            <div className="space-y-3 max-w-sm">
              <div className="space-y-1.5">
                <Label>Client ID</Label>
                <Input
                  placeholder="GitHub OAuth Client ID"
                  value={clientId}
                  defaultValue={settings.githubClientId}
                  onChange={e => setClientId(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Client Secret</Label>
                <Input
                  type="password"
                  placeholder="••••••••••••"
                  value={clientSecret}
                  onChange={e => setClientSecret(e.target.value)}
                />
              </div>
              <Button onClick={saveGitHub} disabled={loading} variant="outline">
                {loading ? 'Saving…' : 'Save GitHub App Keys'}
              </Button>
            </div>

            {settings.githubClientId && settings.hasGithubSecret && (
              <div className="flex items-center gap-4 mt-4 p-4 rounded-lg border border-border">
                <div className="text-2xl">{settings.hasGithubToken ? '✅' : '❌'}</div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {settings.hasGithubToken ? 'Connected to GitHub' : 'Not connected to GitHub'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {settings.hasGithubToken ? 'Your OAuth token is active.' : 'Click to authorize with GitHub.'}
                  </p>
                </div>
                <Button size="sm" onClick={connectGitHub} className="ml-auto">
                  {settings.hasGithubToken ? 'Reconnect' : 'Connect GitHub'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* About */}
        <Card className="bg-card border-border">
          <CardHeader><CardTitle className="text-base">About</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Sada Mia HostPanel v2 — Premium Next.js management interface.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
