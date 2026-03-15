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
    <div className="page-shell flex min-h-screen items-center px-4 py-12 sm:px-6 relative">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute top-1/4 left-0 h-[400px] w-[400px] rounded-full bg-[rgba(124,92,255,0.08)] blur-[150px]" />
      <div className="pointer-events-none absolute bottom-1/4 right-0 h-[300px] w-[300px] rounded-full bg-[rgba(96,165,250,0.06)] blur-[120px]" />

      <div className="grid w-full gap-8 xl:grid-cols-[1.05fr_0.95fr] relative">
        <section className="page-hero border-[rgba(124,92,255,0.12)]">
          <div className="page-hero-inner">
            <div className="toolbar-chip w-fit border-[rgba(124,92,255,0.2)] bg-[rgba(124,92,255,0.08)] text-[#8f73ff]">
              Keyword architecture control center
            </div>
            <div className="max-w-3xl">
              <p className="text-lg text-text-secondary">Professional content planning, without spreadsheet chaos.</p>
              <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-[3.2rem] gradient-text">
                Build professional pillar and cluster research for real businesses.
              </h1>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-text-secondary sm:text-base">
                Audit existing site coverage, research relevant competitors, avoid cannibalization,
                and export a polished XLSX ready for strategy, writers, or clients.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {[
                'Protected private workspaces',
                'English and Hebrew research modes',
                'Styled Excel exports with history',
              ].map((item) => (
                <div key={item} className="rounded-[24px] border border-[rgba(124,92,255,0.1)] bg-[rgba(124,92,255,0.04)] px-4 py-4 text-sm leading-6 text-text-secondary backdrop-blur-sm">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>
        <div className="flex items-center">
          <AuthForm mode="login" />
        </div>
      </div>
    </div>
  );
}
