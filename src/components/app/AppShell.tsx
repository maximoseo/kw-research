'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ClipboardList, Download, FolderKanban, History, LayoutDashboard, SearchCheck } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import { cn } from '@/lib/utils';
import { LogoutButton } from './LogoutButton';

const primaryNav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard#new-research', label: 'New research', icon: SearchCheck },
  { href: '/dashboard#history', label: 'History', icon: History },
];

export function AppShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: { email: string; displayName: string };
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-transparent">
      <aside className="hidden w-[318px] shrink-0 flex-col border-r border-white/5 bg-sidebar-bg px-5 py-5 text-sidebar-text lg:flex before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-accent/40 before:to-transparent relative">
        <Link
          href="/dashboard"
          className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.04))] px-5 py-5 shadow-[0_30px_80px_-55px_rgba(14,165,233,0.8)] backdrop-blur"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow text-white/55">Research workspace</p>
              <div className="mt-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-accent/25 bg-accent/15 text-accent">
                  <FolderKanban className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-base font-semibold text-white">KW Research</p>
                  <p className="text-sm text-white/58">Pillars, clusters, and XLSX delivery</p>
                </div>
              </div>
            </div>
            <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-200">
              Active
            </div>
          </div>
          <div className="mt-5 flex items-center gap-2 text-xs text-white/52">
            <Download className="h-4 w-4 text-accent" />
            Logged research runs, previews, and downloadable Excel exports
          </div>
        </Link>

        <div className="mt-8 px-3">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/38">Navigation</p>
        </div>

        <nav className="mt-3 space-y-1">
          {primaryNav.map((item) => (
            <SidebarLink
              key={item.href}
              href={item.href}
              active={pathname === '/dashboard' && item.href.startsWith('/dashboard')}
              icon={item.icon}
            >
              {item.label}
            </SidebarLink>
          ))}
          <SidebarLink href="/runs" active={pathname.startsWith('/runs')} icon={ClipboardList}>
            Runs
          </SidebarLink>
        </nav>

        <div className="mt-6 rounded-[28px] border border-white/8 bg-white/[0.04] p-4">
          <p className="eyebrow text-white/45">Pipeline</p>
          <div className="mt-4 space-y-3 text-sm text-white/65">
            {[
              'Site understanding from homepage, about page, and sitemap',
              'Competitor theme discovery tuned by language and market',
              'Deduplicated pillars, clusters, and polished workbook output',
            ].map((item) => (
              <div key={item} className="rounded-[20px] border border-white/10 bg-white/[0.03] px-3 py-3">
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-auto rounded-[28px] border border-white/10 bg-white/[0.055] p-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-sm font-semibold text-white">
              {user.displayName.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{user.displayName}</p>
              <p className="truncate text-xs text-white/50">{user.email}</p>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <ThemeToggle />
            <LogoutButton />
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-border/60 bg-background/76 backdrop-blur-xl">
          <div className="page-shell flex items-center justify-between gap-4 px-4 py-4 sm:px-6">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="toolbar-chip">
                  <span className="h-2 w-2 rounded-full bg-success animate-pulse-dot" />
                  Protected workspace
                </span>
                <span className="toolbar-chip hidden sm:inline-flex">Background research queue</span>
              </div>
              <h1 className="mt-3 text-xl font-semibold tracking-tight sm:text-[1.65rem]">Keyword Research Dashboard</h1>
              <p className="mt-1 text-sm text-text-secondary">
                Crawl, model, deduplicate, preview, and export structured pillar-cluster plans.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden rounded-full border border-border/70 bg-surface-raised/70 px-3 py-1.5 text-xs font-medium text-text-secondary md:inline-flex">
                Single-run job orchestration with persistent history
              </div>
              <div className="flex items-center gap-3 lg:hidden">
                <ThemeToggle />
                <LogoutButton />
              </div>
            </div>
          </div>
        </header>
        <main className="page-shell flex flex-1 flex-col px-4 py-8 sm:px-6">{children}</main>
      </div>
    </div>
  );
}

function SidebarLink({
  href,
  active,
  icon: Icon,
  children,
}: {
  href: string;
  active: boolean;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'group flex items-center justify-between gap-3 rounded-[22px] border px-3.5 py-3 text-sm font-medium transition-all',
        active
          ? 'border-accent/25 bg-accent/[0.12] text-white shadow-[0_18px_40px_-34px_rgba(14,165,233,0.9)]'
          : 'border-transparent text-white/60 hover:border-white/10 hover:bg-white/[0.055] hover:text-white',
      )}
    >
      <span className="flex items-center gap-3">
        <span
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-2xl border transition-all',
            active
              ? 'border-accent/20 bg-accent/[0.14] text-accent'
              : 'border-white/8 bg-white/[0.035] text-white/60 group-hover:border-white/12 group-hover:text-white',
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        {children}
      </span>
      {active ? <span className="h-2 w-2 rounded-full bg-accent" /> : null}
    </Link>
  );
}
