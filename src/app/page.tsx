import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, BarChart3, BrainCircuit, Sparkles } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { getCurrentUser } from '@/server/auth/session';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'KW Research · Maximo SEO',
  description:
    'Professional keyword research workspace. Discover high-value keywords, analyze difficulty, and plan content strategies with AI-powered insights.',
};

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) redirect('/dashboard');

  return (
    <main className="page-shell min-h-screen px-4 py-10 sm:py-14">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <section className="space-y-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/[0.06] px-4 py-1.5 text-xs font-semibold text-accent">
            <Sparkles className="h-3.5 w-3.5" />
            Maximo SEO · authenticated workspace
          </span>
          <div className="space-y-4 max-w-2xl">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Keyword research, built as a real dashboard.
            </h1>
            <p className="text-base leading-7 text-text-secondary sm:text-lg">
              Sign in to access project dashboards, run history, overlap analysis,
              cannibalization checks, content mapping, and export-ready research workbooks.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/auth/login">
              <Button size="lg" icon={<ArrowRight className="h-4 w-4" />}>
                Sign in to dashboard
              </Button>
            </Link>
            <Link href="/auth/register">
              <Button size="lg" variant="secondary">
                Create account
              </Button>
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { title: 'Research runs', desc: 'Track progress, compare results, export workbooks.', icon: BarChart3 },
              { title: 'AI workflows', desc: 'Questions, briefs, overlap, intent and content mapping.', icon: BrainCircuit },
              { title: 'Live dashboards', desc: 'Authenticated views built for repeatable SEO work.', icon: Sparkles },
            ].map((item) => (
              <Card key={item.title} padding="sm" className="space-y-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-accent/15 bg-accent/[0.06]">
                  <item.icon className="h-4 w-4 text-accent" />
                </div>
                <h2 className="text-sm font-semibold text-text-primary">{item.title}</h2>
                <p className="text-xs leading-5 text-text-muted">{item.desc}</p>
              </Card>
            ))}
          </div>
        </section>

        <Card variant="hero" padding="lg" className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Live dashboard path</p>
              <h2 className="text-heading-1 mt-1">/dashboard</h2>
            </div>
            <div className="rounded-full border border-success/20 bg-success/[0.08] px-3 py-1 text-xs font-semibold text-success">
              Auth required
            </div>
          </div>
          <div className="space-y-3 text-sm text-text-secondary">
            <p>Public root is only the gateway. The actual product lives inside the authenticated dashboard.</p>
            <ul className="space-y-2">
              <li>• Project-level SEO research</li>
              <li>• Overlap / cannibalization analysis</li>
              <li>• Content briefs and keyword mapping</li>
              <li>• Workbook export + run history</li>
            </ul>
          </div>
          <div className="rounded-xl border border-border/50 bg-surface/80 p-4">
            <p className="text-caption text-text-muted">Live subdomain</p>
            <p className="mt-1 font-medium text-text-primary">kw-research.maximo-seo.ai</p>
          </div>
        </Card>
      </div>
    </main>
  );
}
