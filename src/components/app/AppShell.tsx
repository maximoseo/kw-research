'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeftRight, Compass, FolderKanban, Globe, History, SearchCheck } from 'lucide-react';
import type { ResearchProjectDetail } from '@/lib/research';
import { buildProjectDashboardPath } from '@/lib/project-context';
import { cn } from '@/lib/utils';
import ThemeToggle from '@/components/ThemeToggle';
import { LogoutButton } from './LogoutButton';

export function AppShell({
  children,
  user,
  project,
}: {
  children: React.ReactNode;
  user: { email: string; displayName: string };
  project: ResearchProjectDetail;
}) {
  const pathname = usePathname();
  const dashboardPath = buildProjectDashboardPath(project.id);
  const navItems = [
    { href: dashboardPath, label: 'Overview', icon: Compass, active: pathname === dashboardPath || pathname.startsWith(`${dashboardPath}/`) },
    { href: `${dashboardPath}#new-research`, label: 'New run', icon: SearchCheck, active: false },
    { href: `${dashboardPath}#history`, label: 'History', icon: History, active: false },
  ];

  return (
    <div className="flex min-h-screen bg-transparent">
      <aside className="hidden w-[320px] shrink-0 flex-col border-r border-[rgba(124,92,255,0.08)] bg-sidebar-bg px-5 py-5 text-sidebar-text lg:flex">
        <Link
          href="/dashboard"
          className="rounded-[30px] border border-[rgba(124,92,255,0.15)] bg-[linear-gradient(180deg,rgba(124,92,255,0.12),rgba(124,92,255,0.04))] px-5 py-5 shadow-[0_30px_80px_-55px_rgba(124,92,255,0.5)] backdrop-blur"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow text-white/55">Selected website</p>
              <div className="mt-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[rgba(124,92,255,0.25)] bg-[rgba(124,92,255,0.15)] text-[#7c5cff]">
                  <FolderKanban className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-base font-semibold text-white">{project.brandName}</p>
                  <p className="text-sm text-white/58">{project.market} · {project.language}</p>
                </div>
              </div>
            </div>
            <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-200">
              Active
            </div>
          </div>
          <div className="mt-5 flex items-center gap-2 text-xs text-white/52">
            <Globe className="h-4 w-4 text-[#7c5cff]" />
            Return to the site selector to switch workspaces safely
          </div>
        </Link>

        <div className="mt-8 px-3">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/38">Navigation</p>
        </div>

        <nav className="mt-3 space-y-1">
          {navItems.map((item) => (
            <SidebarLink
              key={item.href}
              href={item.href}
              active={item.active}
              icon={item.icon}
            >
              {item.label}
            </SidebarLink>
          ))}
          <SidebarLink href="/dashboard" active={false} icon={ArrowLeftRight}>
            Switch site
          </SidebarLink>
        </nav>

        <div className="mt-6 rounded-[28px] border border-[rgba(124,92,255,0.08)] bg-[rgba(124,92,255,0.04)] p-4">
          <p className="eyebrow text-white/45">Workspace contract</p>
          <div className="mt-4 space-y-3 text-sm text-white/65">
            {[
              'Every internal dashboard route now requires a valid selected site context.',
              'This workspace only shows runs, logs, and downloads for the current website.',
              'Use Switch site to leave this dashboard cleanly and select another project.',
            ].map((item) => (
              <div key={item} className="rounded-[20px] border border-[rgba(124,92,255,0.1)] bg-[rgba(124,92,255,0.03)] px-3 py-3">
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-auto rounded-[28px] border border-[rgba(124,92,255,0.12)] bg-[rgba(124,92,255,0.06)] p-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[rgba(124,92,255,0.15)] bg-[rgba(124,92,255,0.1)] text-sm font-semibold text-white">
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
        <header className="sticky top-0 z-20 border-b border-[rgba(124,92,255,0.08)] bg-[rgba(10,13,23,0.95)] backdrop-blur-xl">
          <div className="page-shell flex flex-col gap-4 px-4 py-4 sm:px-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="toolbar-chip border-[rgba(124,92,255,0.15)]">
                    <span className="h-2 w-2 rounded-full bg-success animate-pulse-dot" />
                    Site-scoped workspace
                  </span>
                  <span className="toolbar-chip hidden sm:inline-flex border-[rgba(124,92,255,0.1)]">
                    {project.brandName} · {project.market}
                  </span>
                </div>
                <h1 className="mt-3 text-xl font-semibold tracking-tight sm:text-[1.65rem]">
                  {project.brandName} Dashboard
                </h1>
                <p className="mt-1 text-sm text-text-secondary">
                  Research runs, logs, and exports for the currently selected website only.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-3">
                <Link
                  href="/dashboard"
                  className="inline-flex min-h-[40px] items-center justify-center rounded-2xl border border-border/80 bg-surface-raised/80 px-4 py-2 text-sm font-medium text-text-primary transition-all hover:-translate-y-0.5 hover:border-accent/20 hover:bg-surface"
                >
                  Switch site
                </Link>
                <div className="flex items-center gap-3 lg:hidden">
                  <ThemeToggle />
                  <LogoutButton />
                </div>
              </div>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
              {navItems.map((item) => (
                <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'whitespace-nowrap rounded-full border px-3.5 py-2 text-sm font-medium transition-all',
                      item.active
                      ? 'border-[rgba(124,92,255,0.3)] bg-[rgba(124,92,255,0.16)] text-white'
                      : 'border-[rgba(124,92,255,0.12)] bg-[rgba(124,92,255,0.06)] text-white/72 hover:border-[rgba(124,92,255,0.2)] hover:text-white',
                  )}
                >
                  {item.label}
                </Link>
              ))}
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
          ? 'border-[rgba(124,92,255,0.25)] bg-[rgba(124,92,255,0.12)] text-white shadow-[0_18px_40px_-34px_rgba(124,92,255,0.7)]'
          : 'border-transparent text-white/60 hover:border-[rgba(124,92,255,0.1)] hover:bg-[rgba(124,92,255,0.06)] hover:text-white',
      )}
    >
      <span className="flex items-center gap-3">
        <span
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-2xl border transition-all',
            active
              ? 'border-[rgba(124,92,255,0.2)] bg-[rgba(124,92,255,0.14)] text-[#7c5cff]'
              : 'border-white/8 bg-white/[0.035] text-white/60 group-hover:border-[rgba(124,92,255,0.15)] group-hover:text-white',
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        {children}
      </span>
      {active ? <span className="h-2 w-2 rounded-full bg-[#7c5cff]" /> : null}
    </Link>
  );
}
