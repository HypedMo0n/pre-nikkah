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
  return (
    <div
      aria-live="polite"
      className={cn(
        "rounded-input border px-4 py-3 font-productive text-[13px] leading-5",
        status === "success" ? "border-green bg-green-soft text-green" : "border-danger bg-white text-danger",
      )}
      role={status === "error" ? "alert" : "status"}
    >
      {message}
    </div>
  );
}
