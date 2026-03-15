import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/server/auth/session';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const user = await getCurrentUser();
  redirect(user ? '/dashboard' : '/auth/login');
}
