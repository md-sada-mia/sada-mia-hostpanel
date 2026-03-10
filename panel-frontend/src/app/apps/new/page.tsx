'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

interface Repo { full_name: string; clone_url: string; default_branch: string; private: boolean }

type DeployPhase = 'idle' | 'creating' | 'deploying' | 'done' | 'error';

export default function NewAppPage() {
  const router = useRouter();

  // Form state
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [type, setType] = useState<'laravel' | 'nextjs'>('laravel');
  const [repoSource, setRepoSource] = useState<'github' | 'manual'>('github');
  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [createDb, setCreateDb] = useState(true);
  const [selectedRepo, setSelectedRepo] = useState('');
  const [repos, setRepos] = useState<Repo[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [reposLoading, setReposLoading] = useState(false);

  // Deploy state
  const [phase, setPhase] = useState<DeployPhase>('idle');
  const [logLines, setLogLines] = useState<string[]>(['Waiting for deployment to start…']);
  const [deployedSlug, setDeployedSlug] = useState('');
  const logRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-scroll logs
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logLines]);

  // Auto-fill domain from name
  useEffect(() => {
    if (name && !domain) setDomain(`${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.test`);
  }, [name]);

  const appendLog = useCallback((...lines: string[]) => {
    setLogLines(prev => [...prev, ...lines]);
  }, []);

  // Load GitHub repos on mount
  useEffect(() => {
    if (repoSource !== 'github') return;
    setReposLoading(true);
    apiFetch<Repo[]>('/api/github/repos')
      .then(setRepos)
      .catch(() => { setRepoSource('manual'); toast.error('Connect GitHub in Settings to use repo picker.'); })
      .finally(() => setReposLoading(false));
  }, [repoSource]);

  const handleRepoSelect = async (fullName: string) => {
    const repo = repos.find(r => r.full_name === fullName);
    if (!repo) return;
    setSelectedRepo(fullName);
    setRepoUrl(repo.clone_url);
    setBranch(repo.default_branch);
    try {
      const data = await apiFetch<string[]>(`/api/github/repos/${encodeURIComponent(fullName)}/branches`);
      setBranches(data);
      setBranch(data[0] || repo.default_branch);
    } catch {
      setBranches([repo.default_branch]);
    }
  };

  const startPoll = (slug: string) => {
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts++;
      try {
        const data = await apiFetch<{ app: { status: string } }>(`/api/apps/${slug}`);
        if (data.app.status !== 'deploying') {
          clearInterval(pollRef.current!);
          if (data.app.status === 'running') {
            setPhase('done');
            appendLog('', '✅ Deployment completed successfully!');
            toast.success(`"${slug}" is live!`);
          } else {
            setPhase('error');
            appendLog('', `❌ Deployment ended with status: ${data.app.status}`);
            toast.error(`Deployment failed for "${slug}"`);
          }
        }
        // fetch latest logs
        const logData = await apiFetch<{ log: string }>(`/api/apps/${slug}/logs?lines=50`);
        if (logData.log) setLogLines(logData.log.split('\n').filter(Boolean));
      } catch { /* keep polling */ }
      if (attempts > 72) { // 6 minutes max
        clearInterval(pollRef.current!);
        setPhase('error');
        appendLog('', '⏱ Deployment timed out after 6 minutes.');
      }
    }, 5000);
  };

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const handleDeploy = async () => {
    if (!name.trim() || !repoUrl.trim() || !domain.trim()) {
      toast.error('Name, Repository URL and Domain are required.');
      return;
    }
    setLogLines([`🔧 Creating app "${name}"…`]);
    setPhase('creating');

    try {
      appendLog(`   type: ${type}`, `   domain: ${domain}`, `   repo: ${repoUrl}`, `   branch: ${branch}`, '');
      const res = await apiFetch<{ app: { slug: string } }>('/api/apps', {
        method: 'POST',
        body: JSON.stringify({ name, domain, type, repoUrl, branch, createDb }),
      });
      const slug = res.app.slug;
      setDeployedSlug(slug);
      appendLog(`✓ App "${slug}" created.`, '', '▶ Triggering deployment…', '');
      setPhase('deploying');

      await apiFetch(`/api/apps/${slug}/deploy`, { method: 'POST' });
      appendLog('  Build started. Following logs…', '');
      startPoll(slug);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      appendLog('', `❌ Error: ${msg}`);
      setPhase('error');
      toast.error(msg);
    }
  };

  const phaseColor: Record<DeployPhase, string> = {
    idle: 'secondary', creating: 'secondary', deploying: 'secondary', done: 'default', error: 'destructive',
  } as Record<DeployPhase, string>;

  const phaseLabel: Record<DeployPhase, string> = {
    idle: '⬦ Ready', creating: '⟳ Creating…', deploying: '⟳ Deploying…', done: '✓ Live', error: '✕ Failed',
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar onNewApp={() => router.push('/apps/new')} />

      <main className="flex-1 lg:pl-64 flex flex-col min-h-screen">
        {/* Header */}
        <div className="border-b border-border px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="text-muted-foreground hover:text-foreground transition-colors text-sm">
              ← Back
            </button>
            <h1 className="text-lg font-semibold text-foreground">🚀 Deploy New Application</h1>
          </div>
          <Badge variant={phaseColor[phase] as 'default' | 'secondary' | 'destructive' | 'outline'}>
            {phaseLabel[phase]}
          </Badge>
        </div>

        {/* Split Panel */}
        <div className="flex flex-1 divide-x divide-border overflow-hidden">
          {/* ── LEFT: Config ──────────────────────────────── */}
          <div className="w-full lg:w-1/2 p-6 overflow-y-auto space-y-5">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">Configuration</h2>

            {/* Name + Type */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>App Name *</Label>
                <Input placeholder="my-blog" value={name} onChange={e => setName(e.target.value)} disabled={phase !== 'idle'} />
              </div>
              <div className="space-y-1.5">
                <Label>App Type *</Label>
                <Select value={type} onValueChange={v => v && setType(v as 'laravel' | 'nextjs')} disabled={phase !== 'idle'}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="laravel">🐘 Laravel</SelectItem>
                    <SelectItem value="nextjs">⬡ Next.js</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Domain */}
            <div className="space-y-1.5">
              <Label>Domain *</Label>
              <Input placeholder="myapp.example.com" value={domain} onChange={e => setDomain(e.target.value)} disabled={phase !== 'idle'} />
              <p className="text-xs text-muted-foreground">Add it to <code className="bg-muted px-1 rounded">/etc/hosts</code> for local testing.</p>
            </div>

            {/* Repo source */}
            <div className="space-y-2">
              <Label>Repository Source</Label>
              <div className="flex gap-4 text-sm">
                {(['github', 'manual'] as const).map(src => (
                  <label key={src} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" checked={repoSource === src} onChange={() => setRepoSource(src)} disabled={phase !== 'idle'} />
                    {src === 'github' ? 'GitHub Picker' : 'Manual URL'}
                  </label>
                ))}
              </div>
            </div>

            {repoSource === 'github' ? (
              <>
                <div className="space-y-1.5">
                  <Label>Repository</Label>
                  <Select onValueChange={v => v && handleRepoSelect(v)} value={selectedRepo} disabled={phase !== 'idle'}>
                    <SelectTrigger><SelectValue placeholder={reposLoading ? 'Loading…' : '— Select repository —'} /></SelectTrigger>
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
                    <Label>Branch</Label>
                    <Select value={branch} onValueChange={v => v && setBranch(v)} disabled={phase !== 'idle'}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{branches.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
              </>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2">
                  <Label>Git Clone URL *</Label>
                  <Input placeholder="https://github.com/user/repo.git" value={repoUrl} onChange={e => setRepoUrl(e.target.value)} disabled={phase !== 'idle'} />
                </div>
                <div className="space-y-1.5">
                  <Label>Branch *</Label>
                  <Input placeholder="main" value={branch} onChange={e => setBranch(e.target.value)} disabled={phase !== 'idle'} />
                </div>
              </div>
            )}

            {/* Database */}
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={createDb} onChange={e => setCreateDb(e.target.checked)} disabled={phase !== 'idle'} />
              Auto-provision a PostgreSQL database
            </label>

            {/* CTA */}
            <div className="flex gap-3 pt-2">
              <Button
                className="flex-1"
                onClick={handleDeploy}
                disabled={phase !== 'idle'}
              >
                {phase === 'idle' ? '🚀 Create & Deploy' : '⟳ Deploying…'}
              </Button>
              {phase === 'done' && (
                <Button variant="outline" onClick={() => router.push('/')}>
                  ← Dashboard
                </Button>
              )}
              {phase === 'error' && (
                <Button variant="outline" onClick={() => setPhase('idle')}>
                  ↩ Try Again
                </Button>
              )}
            </div>
          </div>

          {/* ── RIGHT: Logs ──────────────────────────────── */}
          <div className="hidden lg:flex flex-col w-1/2">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">Deployment Log</h2>
              <div className="flex items-center gap-2">
                {phase === 'deploying' && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-yellow-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                    Live
                  </span>
                )}
                {phase === 'done' && <span className="text-xs text-green-400">✓ Complete</span>}
                {phase === 'error' && <span className="text-xs text-red-400">✕ Failed</span>}
              </div>
            </div>

            <div
              ref={logRef}
              className="flex-1 overflow-y-auto bg-black/60 p-4 font-mono text-xs text-green-400 leading-5"
            >
              {logLines.map((line, i) => (
                <div key={i} className={line.startsWith('❌') ? 'text-red-400' : line.startsWith('✅') ? 'text-emerald-400' : line.startsWith('▶') ? 'text-yellow-300' : ''}>
                  {line || <br />}
                </div>
              ))}
              {(phase === 'deploying' || phase === 'creating') && (
                <div className="flex items-center gap-1 mt-1">
                  <span className="animate-pulse">▌</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
