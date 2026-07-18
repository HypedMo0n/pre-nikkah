import { redirect } from "next/navigation";

import { hasPublicEnv } from "@/lib/env/public";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PrivateAppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  if (!hasPublicEnv()) {
    redirect("/sign-in");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  return <div className="min-h-screen bg-background">{children}</div>;
}
