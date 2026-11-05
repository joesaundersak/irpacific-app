import { redirect } from 'next/navigation'

/** Old URL: the page is now called Action Items. */
export default async function AccountabilityRedirect({ searchParams }: { searchParams: Promise<{ user?: string }> }) {
  const { user } = await searchParams
  redirect(user ? `/action-items?user=${encodeURIComponent(user)}` : '/action-items')
}
