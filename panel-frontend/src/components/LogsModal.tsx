'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface LogsModalProps {
  slug: string | null;
  onClose: () => void;
}

export default function LogsModal({ slug, onClose }: LogsModalProps) {
  const [logs, setLogs] = useState('Loading…');
  const [loading, setLoading] = useState(false);

  const fetchLogs = async (s: string) => {
    setLoading(true);
    try {
      const data = await apiFetch<{ log: string }>(`/api/apps/${s}/logs?lines=300`);
      setLogs(data.log || '(empty)');
    } catch (e: unknown) {
      if (e instanceof Error) toast.error(e.message);
      setLogs('Error fetching logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (slug) fetchLogs(slug);
  }, [slug]);

  return (
    <Dialog open={!!slug} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-3xl w-full bg-card border-border">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Deploy Logs — <span className="font-mono text-primary">{slug}</span></DialogTitle>
            <Button variant="ghost" size="sm" onClick={() => slug && fetchLogs(slug)} disabled={loading}>
              ↻ Refresh
            </Button>
          </div>
        </DialogHeader>
        <pre className="bg-black/50 rounded-lg p-4 text-xs text-green-400 font-mono overflow-auto max-h-[60vh] whitespace-pre-wrap">
          {logs}
        </pre>
      </DialogContent>
    </Dialog>
  );
}
