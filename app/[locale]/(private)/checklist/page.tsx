import { redirect } from "next/navigation";

export default async function RetiredChecklistPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/topics`);
}
