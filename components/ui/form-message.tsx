import { AlertCircle, CheckCircle2 } from "lucide-react";

import { cn } from "@/lib/utils";

export function FormMessage({
  message,
  status,
}: {
  message?: string;
  status: "idle" | "error" | "success";
}) {
  if (!message || status === "idle") {
    return null;
  }
  const Icon = status === "success" ? CheckCircle2 : AlertCircle;
  return (
    <div
      aria-live="polite"
      className={cn(
        "flex items-start gap-2 rounded-productive border p-3 text-sm leading-6",
        status === "success"
          ? "border-aligned/30 bg-aligned-soft text-aligned"
          : "border-concern/30 bg-concern-soft text-concern",
      )}
      role={status === "error" ? "alert" : "status"}
    >
      <Icon aria-hidden="true" className="mt-0.5 shrink-0" size={17} />
      <span>{message}</span>
    </div>
  );
}
