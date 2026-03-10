'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface EnvRow { key: string; value: string }

interface EnvModalProps {
  slug: string | null;
  onClose: () => void;
}

export default function EnvModal({ slug, onClose }: EnvModalProps) {
  const [rows, setRows] = useState<EnvRow[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!slug) return;
    apiFetch<{ env: Record<string, string> }>(`/api/apps/${slug}/env`)
      .then(data => {
        setRows(Object.entries(data.env || {}).map(([key, value]) => ({ key, value })));
      })
      .catch(e => {
        if (e instanceof Error) toast.error(e.message);
      });
  }, [slug]);

  const updateRow = (i: number, field: 'key' | 'value', val: string) =>
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: val } : r));

  const addRow = () => setRows(prev => [...prev, { key: '', value: '' }]);
  const removeRow = (i: number) => setRows(prev => prev.filter((_, idx) => idx !== i));

  const save = async () => {
    if (!slug) return;
    setSaving(true);
    const env: Record<string, string> = {};
    rows.forEach(r => { if (r.key.trim()) env[r.key.trim()] = r.value; });
    try {
      await apiFetch(`/api/apps/${slug}/env`, { method: 'PUT', body: JSON.stringify({ env }) });
      toast.success(`Environment saved for "${slug}"`);
      onClose();
    } catch (e: unknown) {
      if (e instanceof Error) toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!slug} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-2xl w-full bg-card border-border">
        <DialogHeader>
          <DialogTitle>Environment — <span className="font-mono text-primary">{slug}</span></DialogTitle>
        </DialogHeader>

        <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
          {rows.map((row, i) => (
            <div key={i} className="flex gap-2 items-center">
              <Input
                placeholder="KEY"
                value={row.key}
                onChange={e => updateRow(i, 'key', e.target.value)}
                className="font-mono text-xs w-1/3"
              />
              <Input
                placeholder="value"
                value={row.value}
                onChange={e => updateRow(i, 'value', e.target.value)}
                className="font-mono text-xs flex-1"
              />
              <Button variant="ghost" size="sm" onClick={() => removeRow(i)}>✕</Button>
            </div>
          ))}
        </div>

        <Button variant="ghost" size="sm" className="mt-2 w-fit" onClick={addRow}>＋ Add Row</Button>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? 'Saving…' : '💾 Save Environment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
