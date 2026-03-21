'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeftRight, Compass, FolderKanban, History, SearchCheck } from 'lucide-react';
import type { ResearchProjectDetail } from '@/lib/research';
import { buildProjectDashboardPath } from '@/lib/project-context';
import { cn } from '@/lib/utils';
import ThemeToggle from '@/components/ThemeToggle';
import { Badge, Button } from '@/components/ui';
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
      {/* ── Sidebar ── */}
      <aside className="hidden w-[260px] shrink-0 flex-col border-r border-border/40 bg-sidebar-bg px-4 py-5 text-sidebar-text xl:flex">
        <div className="rounded-lg border border-accent/12 bg-accent/[0.04] p-3.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sidebar-text/40">Workspace</p>
              <div className="mt-2.5 flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-accent/15 bg-accent/[0.08] text-accent">
                  <FolderKanban className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-body-sm font-semibold text-white">{project.brandName}</p>
                  <p className="truncate text-caption text-sidebar-text/50">{project.market} · {project.language}</p>
                </div>
              </div>
            </div>
            <Badge variant="success" className="border-success/15 bg-success/[0.08] text-success" dot={false}>
              Active
            </Badge>
          </div>
          <Link href="/dashboard" className="mt-3 block">
            <span className="inline-flex w-full items-center justify-between gap-2 rounded-lg border border-white/8 px-3 py-2 text-body-sm font-medium text-sidebar-text/70 transition-all hover:border-white/12 hover:bg-white/[0.04] hover:text-white">
              Switch site
              <ArrowLeftRight className="h-3 w-3" />
            </span>
          </Link>
        </div>

        <nav className="mt-5 space-y-0.5">
          {navItems.map((item) => (
            <SidebarLink key={item.href} href={item.href} active={item.active} icon={item.icon}>
              {item.label}
            </SidebarLink>
          ))}
        </nav>

        <div className="mt-auto rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-accent/12 bg-accent/[0.06] text-caption font-semibold text-white">
              {user.displayName.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-body-sm font-semibold text-white">{user.displayName}</p>
              <p className="truncate text-caption text-sidebar-text/45">{user.email}</p>
            </div>
          </div>
          <div className="mt-2.5 flex items-center justify-between gap-2">
            <ThemeToggle />
            <LogoutButton />
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-border/40 bg-surface/90 backdrop-blur-lg">
          <div className="page-shell flex flex-col gap-2.5 px-4 py-3 sm:px-6 sm:py-3.5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-heading-2 text-text-primary truncate">
                  {project.brandName}
                </h1>
              </div>
              <div className="flex items-center gap-2">
                <Link href="/dashboard" className="hidden sm:block">
                  <Button variant="ghost" size="sm">Switch site</Button>
                </Link>
                <div className="flex items-center gap-2 xl:hidden">
                  <ThemeToggle />
                  <LogoutButton />
                </div>
              </div>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 xl:hidden" style={{ scrollbarWidth: 'none' }}>
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'whitespace-nowrap rounded-md border px-3.5 py-2 text-body-sm font-semibold transition-all',
                    item.active
                      ? 'border-accent/25 bg-accent/[0.08] text-accent'
                      : 'border-border/40 bg-surface-raised/80 text-text-muted hover:border-accent/15 hover:text-text-primary',
                  )}
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href="/dashboard"
                className="whitespace-nowrap rounded-md border border-border/40 bg-surface-raised/80 px-3.5 py-2 text-body-sm font-semibold text-text-muted hover:border-accent/15 hover:text-text-primary transition-all sm:hidden"
              >
                Switch site
              </Link>
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
        'group flex items-center gap-2.5 rounded-lg px-3 py-2 text-body-sm font-medium transition-all',
        active
          ? 'bg-accent/[0.08] text-white'
          : 'text-sidebar-text/55 hover:bg-white/[0.03] hover:text-white',
      )}
    >
      <span
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded-md transition-all',
          active
            ? 'bg-accent/[0.12] text-accent'
            : 'text-sidebar-text/45 group-hover:text-white/70',
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      {children}
      {active ? <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent" /> : null}
    </Link>
  );
}
