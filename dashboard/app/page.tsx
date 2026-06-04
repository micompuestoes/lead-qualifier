// Raíz: landing pública si no hay sesión, dashboard si la hay.
import { auth } from '@clerk/nextjs/server';
import DashboardHome from '@/components/DashboardHome';
import MarketingLanding from '@/components/MarketingLanding';

export default async function Page() {
  const { userId } = await auth();
  return userId ? <DashboardHome /> : <MarketingLanding />;
}
