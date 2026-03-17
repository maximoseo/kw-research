import { redirect } from 'next/navigation';
import AuthForm from '@/components/auth/AuthForm';
import { sanitizeRedirectPath } from '@/lib/auth';
import { getCurrentUser } from '@/server/auth/session';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Login · KW Research',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { redirect?: string };
}) {
  const user = await getCurrentUser();
  if (user) {
    redirect(sanitizeRedirectPath(searchParams.redirect));
  }

  return (
    <div className="page-shell relative min-h-screen overflow-x-clip px-4 py-8 sm:px-6 sm:py-10">
      <div className="pointer-events-none absolute left-[-96px] top-14 hidden h-[240px] w-[240px] rounded-full bg-[rgba(124,92,255,0.08)] blur-[120px] sm:block" />
      <div className="pointer-events-none absolute bottom-12 right-[-64px] hidden h-[180px] w-[180px] rounded-full bg-[rgba(96,165,250,0.05)] blur-[100px] sm:block" />

      <div className="grid w-full gap-5 xl:grid-cols-[0.96fr_1.04fr] xl:items-center">
        <div className="order-2 xl:order-1">
          <section className="page-hero border-border/70">
            <div className="page-hero-inner">
              <div className="toolbar-chip w-fit border-accent/18 bg-accent/[0.1] text-accent">
                Premium keyword research workflow
              </div>
              <div className="max-w-3xl">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-text-muted">Maximo SEO platform</p>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight text-text-primary sm:text-[3rem]">
                  Plan clusters, review site coverage, and export polished research without the dashboard noise.
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-text-secondary sm:text-base">
                  Create site-scoped workspaces, run repeatable research, monitor progress, and download client-ready workbooks from one controlled environment.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ['Site-scoped workspaces', 'Each dashboard stays tied to one validated website.'],
                  ['Protected route flow', 'Login recovery keeps users inside the right workspace.'],
                  ['Polished exports', 'Research history, logs, and workbook downloads stay organized.'],
                ].map(([title, description]) => (
                  <div key={title} className="subtle-surface px-4 py-4">
                    <p className="text-sm font-semibold text-text-primary">{title}</p>
                    <p className="mt-2 text-sm leading-6 text-text-secondary">{description}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
        <div className="order-1 flex items-start xl:order-2 xl:justify-end">
          <AuthForm mode="login" />
        </div>
      </div>
    </div>
  );
}
