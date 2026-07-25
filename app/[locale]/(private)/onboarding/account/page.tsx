import { redirect } from "next/navigation";

export default async function RetiredAccountOnboarding({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ code?: string }>;
}) {
  const { locale } = await params;
  const { code } = await searchParams;
  redirect(code ? `/${locale}/join/${encodeURIComponent(code)}` : `/${locale}/dashboard`);
}
