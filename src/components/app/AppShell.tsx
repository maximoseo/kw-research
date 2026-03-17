'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeftRight, Compass, FolderKanban, History, SearchCheck } from 'lucide-react';
import type { ResearchProjectDetail } from '@/lib/research';
import { buildProjectDashboardPath } from '@/lib/project-context';
import { cn } from '@/lib/utils';
import ThemeToggle from '@/components/ThemeToggle';
import { Badge, Button, Card } from '@/components/ui';
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
      <aside className="hidden w-[280px] shrink-0 flex-col border-r border-border/60 bg-sidebar-bg/94 px-4 py-5 text-sidebar-text xl:flex">
        <Card padding="md" variant="hero" className="border-accent/14 bg-[linear-gradient(180deg,hsl(var(--surface))/0.18,hsl(var(--accent))/0.08)] text-white">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="eyebrow text-white/45">Selected website</p>
              <div className="mt-3 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-accent/20 bg-accent/[0.12] text-accent">
                  <FolderKanban className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{project.brandName}</p>
                  <p className="truncate text-xs text-sidebar-text/60">{project.market} · {project.language}</p>
                </div>
              </div>
            </div>
            <Badge variant="success" className="border-success/20 bg-success/[0.1] text-success" dot={false}>
              Active
            </Badge>
          </div>
          <p className="mt-3 text-sm leading-6 text-sidebar-text/65">
            Runs, logs, and exports scoped to this site profile.
          </p>
          <Link href="/dashboard" className="mt-4 block">
            <Button variant="secondary" className="w-full justify-between border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]">
              Switch site
              <ArrowLeftRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </Card>

        <nav className="mt-6 space-y-1">
          {navItems.map((item) => (
            <SidebarLink key={item.href} href={item.href} active={item.active} icon={item.icon}>
              {item.label}
            </SidebarLink>
          ))}
          <SidebarLink href="/dashboard" active={false} icon={ArrowLeftRight}>
            Switch site
          </SidebarLink>
        </nav>

        <div className="mt-auto rounded-xl border border-border/60 bg-surface-raised/[0.5] p-3.5 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-accent/15 bg-accent/10 text-xs font-semibold text-white">
              {user.displayName.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{user.displayName}</p>
              <p className="truncate text-xs text-sidebar-text/55">{user.email}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <ThemeToggle />
            <LogoutButton />
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-border/60 bg-surface/92 backdrop-blur-xl">
          <div className="page-shell flex flex-col gap-3 px-4 py-3.5 sm:px-6 sm:py-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="info" pulse className="border-accent/18 bg-accent/[0.08] text-accent">
                    Site workspace
                  </Badge>
                  <span className="toolbar-chip max-w-full sm:max-w-[240px] truncate">{project.brandName} · {project.market}</span>
                </div>
                <h1 className="mt-2 text-xl font-semibold tracking-tight text-text-primary sm:text-2xl">
                  {project.brandName} dashboard
                </h1>
              </div>
              <div className="stack-mobile md:justify-end">
                <Link href="/dashboard" className="w-full sm:w-auto">
                  <Button variant="secondary" size="sm" className="w-full sm:w-auto">Switch site</Button>
                </Link>
                <div className="flex items-center gap-3 xl:hidden">
                  <ThemeToggle />
                  <LogoutButton />
                </div>
              </div>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-0.5 xl:hidden">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'whitespace-nowrap rounded-full border px-3.5 py-2 text-sm font-semibold transition-all',
                    item.active
                      ? 'border-accent/26 bg-accent/[0.12] text-text-primary'
                      : 'border-border/70 bg-surface-raised/[0.68] text-text-secondary hover:border-accent/18 hover:text-text-primary',
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </header>
        <main className="page-shell flex flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8">{children}</main>
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
        'group flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm font-semibold transition-all',
        active
          ? 'border-accent/22 bg-accent/[0.1] text-white shadow-[0_12px_28px_-20px_rgba(var(--accent-rgb),0.4)]'
          : 'border-transparent text-sidebar-text/65 hover:border-accent/10 hover:bg-white/[0.04] hover:text-white',
      )}
    >
      <span className="flex items-center gap-3">
        <span
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-md border transition-all',
            active
              ? 'border-accent/20 bg-accent/[0.12] text-accent'
              : 'border-white/8 bg-white/[0.035] text-sidebar-text/60 group-hover:border-accent/15 group-hover:text-white',
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        {children}
      </span>
      {active ? <span className="h-1.5 w-1.5 rounded-full bg-accent" /> : null}
    </Link>
  );
}
