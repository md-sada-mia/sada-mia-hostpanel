'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

const NAV_ITEMS = [
  { icon: '◈', label: 'Dashboard', href: '/' },
  { icon: '◎', label: 'Settings', href: '/settings' },
];

interface SidebarProps {
  onNewApp: () => void;
}

export default function Sidebar({ onNewApp }: SidebarProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile toggle */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-card border border-border"
        onClick={() => setOpen(!open)}
      >
        <span className="text-foreground text-xl">☰</span>
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 z-40 bg-card border-r border-border flex flex-col transition-transform duration-300 ${
          open ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        {/* Logo */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-xl">⚡</div>
            <div>
              <div className="font-bold text-foreground">HostPanel</div>
              <div className="text-xs text-muted-foreground">Sada Mia Panel</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1">
          {NAV_ITEMS.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              onClick={() => setOpen(false)}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        {/* New App Button */}
        <div className="p-4 border-t border-border">
          <Button className="w-full" onClick={onNewApp}>
            ＋ New App
          </Button>
        </div>

        {/* Server status */}
        <div className="px-4 pb-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Server Online
          </div>
        </div>
      </aside>
    </>
  );
}
