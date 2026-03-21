import { redirect } from 'next/navigation';
import AuthForm from '@/components/auth/AuthForm';
import { sanitizeRedirectPath } from '@/lib/auth';
import { getCurrentUser } from '@/server/auth/session';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Register · KW Research',
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: { redirect?: string };
}) {
  const user = await getCurrentUser();
  if (user) {
    redirect(sanitizeRedirectPath(searchParams.redirect));
  }

  return (
    <div className="page-shell relative min-h-screen overflow-x-clip px-4 py-8 sm:px-6 sm:py-10 lg:py-14">
      <div className="pointer-events-none absolute left-[-120px] top-8 hidden h-[280px] w-[280px] rounded-full bg-accent/[0.07] blur-[120px] sm:block" />
      <div className="pointer-events-none absolute bottom-8 right-[-80px] hidden h-[200px] w-[200px] rounded-full bg-success/[0.05] blur-[100px] sm:block" />

      <div className="grid w-full gap-8 lg:grid-cols-2 lg:items-center xl:grid-cols-[0.96fr_1.04fr]">
        <div className="order-2 lg:order-1">
          <div className="rounded-2xl border-2 border-accent/15 bg-[linear-gradient(135deg,hsl(var(--accent-surface)),hsl(var(--surface))_50%)] shadow-[0_4px_20px_-4px_rgba(var(--accent-rgb),0.1)]">
            <div className="relative flex flex-col gap-5 px-6 py-7 sm:px-8 sm:py-8">
              <div className="absolute -left-16 -top-16 h-32 w-32 rounded-full bg-accent/[0.06] blur-3xl" />
              <div className="relative">
                <span className="inline-flex items-center gap-2 rounded-full border border-success/20 bg-success/[0.06] px-3 py-1 text-[11px] font-semibold text-success">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                  New workspace onboarding
                </span>
                <div className="max-w-3xl mt-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-accent/50">Analyst setup</p>
                  <h1 className="mt-2 text-2xl font-bold tracking-tight text-text-primary sm:text-3xl lg:text-[2.25rem] lg:leading-tight">
                    Create a secure account for repeatable keyword research.
                  </h1>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-text-secondary sm:text-base">
                    Set up your workspace once, then manage sites, research history, status tracking, and exports.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3 mt-6">
                  {[
                    ['Project history', 'Keep every workspace and research run organized.'],
                    ['Protected access', 'Dashboard routes stay scoped behind authentication.'],
                    ['Operational clarity', 'Track logs, outputs, retries, and downloads.'],
                  ].map(([title, description]) => (
                    <div key={title} className="rounded-xl border border-border/40 bg-surface/60 px-4 py-3">
                      <p className="text-sm font-semibold text-text-primary">{title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-text-secondary">{description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="order-1 flex items-start lg:order-2 lg:justify-end">
          <AuthForm mode="register" />
        </div>
      </div>
    </div>
  );
}
