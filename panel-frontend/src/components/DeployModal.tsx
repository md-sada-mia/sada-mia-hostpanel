'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import type { DeployPayload } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Repo {
  clone_url: string;
  full_name: string;
  default_branch: string;
  private: boolean;
}

interface DeployModalProps {
  open: boolean;
  onClose: () => void;
  onDeploy: (payload: DeployPayload) => Promise<void>;
}

export default function DeployModal({ open, onClose, onDeploy }: DeployModalProps) {
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [type, setType] = useState<'laravel' | 'nextjs'>('laravel');
  const [branch, setBranch] = useState('main');
  const [repoUrl, setRepoUrl] = useState('');
  const [createDb, setCreateDb] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // GitHub repo picker
  const [repoSource, setRepoSource] = useState<'github' | 'manual'>('github');
  const [repos, setRepos] = useState<Repo[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [selectedRepo, setSelectedRepo] = useState('');
  const [reposLoading, setReposLoading] = useState(false);

  useEffect(() => {
    if (open && repoSource === 'github' && repos.length === 0) loadRepos();
  }, [open, repoSource]);

  const loadRepos = async () => {
    setReposLoading(true);
    try {
      const data = await apiFetch<Repo[]>('/api/github/repos');
      setRepos(data);
    } catch {
      setRepoSource('manual');
      toast.error('Could not load GitHub repos. Connect GitHub in Settings first.');
    } finally {
      setReposLoading(false);
    }
  };

  const handleRepoSelect = async (fullName: string) => {
    const repo = repos.find(r => r.full_name === fullName);
    if (!repo) return;
    setSelectedRepo(fullName);
    setRepoUrl(repo.clone_url);
    setBranch(repo.default_branch);
    // Load branches
    try {
      const data = await apiFetch<string[]>(`/api/github/repos/${fullName}/branches`);
      setBranches(data);
      setBranch(data[0] || repo.default_branch);
    } catch {
      setBranches([repo.default_branch]);
    }
  };

  const reset = () => {
    setName(''); setDomain(''); setType('laravel'); setBranch('main');
    setRepoUrl(''); setSelectedRepo(''); setBranches([]); setCreateDb(true);
  };

  const handleSubmit = async () => {
    if (!name || !repoUrl || !domain) {
      toast.error('Name, Repository, and Domain are required');
      return;
    }
    setSubmitting(true);
    try {
      await onDeploy({ name, repoUrl, domain, type, branch, createDb });
      reset();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg w-full bg-card border-border">
        <DialogHeader>
          <DialogTitle>🚀 Deploy New App</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>App Name *</Label>
              <Input placeholder="my-blog" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>App Type *</Label>
              <Select value={type} onValueChange={v => setType(v as 'laravel' | 'nextjs')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="laravel">🐘 Laravel</SelectItem>
                  <SelectItem value="nextjs">⬡ Next.js</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Repository Source</Label>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" checked={repoSource === 'github'} onChange={() => setRepoSource('github')} />
                Select from GitHub
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" checked={repoSource === 'manual'} onChange={() => setRepoSource('manual')} />
                Manual URL
              </label>
            </div>
          </div>

          {repoSource === 'github' ? (
            <>
              <div className="space-y-1.5">
                <Label>Repository *</Label>
                <Select onValueChange={(v) => v && handleRepoSelect(v)} value={selectedRepo}>
                  <SelectTrigger>
                    <SelectValue placeholder={reposLoading ? 'Loading…' : '— Select repository —'} />
                  </SelectTrigger>
                  <SelectContent>
                    {repos.map(r => (
                      <SelectItem key={r.full_name} value={r.full_name}>
                        {r.full_name} {r.private ? '🔒' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {branches.length > 0 && (
                <div className="space-y-1.5">
                  <Label>Branch *</Label>
                  <Select value={branch} onValueChange={(v) => v && setBranch(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {branches.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2">
                <Label>Git URL *</Label>
                <Input placeholder="https://github.com/user/repo.git" value={repoUrl} onChange={e => setRepoUrl(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Branch *</Label>
                <Input placeholder="main" value={branch} onChange={e => setBranch(e.target.value)} />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Domain *</Label>
            <Input placeholder="myapp.example.com" value={domain} onChange={e => setDomain(e.target.value)} />
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={createDb} onChange={e => setCreateDb(e.target.checked)} />
            Automatically provision a PostgreSQL database
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose(); }}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? '⏳ Creating…' : '🚀 Create & Deploy'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
