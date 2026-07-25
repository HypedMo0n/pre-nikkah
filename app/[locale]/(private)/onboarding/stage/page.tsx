import { redirect } from "next/navigation";

export default async function RetiredStageOnboarding({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/dashboard`);
}
