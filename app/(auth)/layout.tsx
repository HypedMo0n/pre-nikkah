import { BrandLockup } from "@/components/brand/brand-lockup";

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="flex min-h-screen flex-col bg-background px-5 py-6 sm:px-8">
      <div className="mx-auto w-full max-w-lg">
        <BrandLockup />
        {children}
      </div>
    </main>
  );
}
