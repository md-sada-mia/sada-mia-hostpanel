'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface AuthGateProps {
  onSuccess: () => void;
}

export default function AuthGate({ onSuccess }: AuthGateProps) {
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!token.trim()) {
      toast.error('Enter your API secret');
      return;
    }
    setLoading(true);
    localStorage.setItem('hp_token', token.trim());
    try {
      await apiFetch('/api/apps');
      toast.success('Authenticated!');
      onSuccess();
    } catch {
      toast.error('Invalid API token');
      localStorage.removeItem('hp_token');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md p-8 rounded-2xl border border-border bg-card shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="text-5xl">⚡</div>
          <h1 className="text-2xl font-bold text-foreground">HostPanel</h1>
          <p className="text-muted-foreground text-sm">Advanced Management Dashboard</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="token">API Secret</Label>
            <Input
              id="token"
              type="password"
              placeholder="Paste your PANEL_SECRET here…"
              value={token}
              onChange={e => setToken(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              className="text-center"
            />
            <p className="text-xs text-muted-foreground text-center">
              Found in <code className="bg-muted px-1 rounded">/etc/hostpanel/config.json</code>
            </p>
          </div>

          <Button
            className="w-full"
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? 'Verifying...' : 'Login to Panel'}
          </Button>
        </div>
      </div>
    </div>
  );
}
