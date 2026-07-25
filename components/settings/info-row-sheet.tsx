"use client";

import { useState } from "react";
import type { ReactNode } from "react";

import { Sheet } from "@/components/ui/sheet";

// A settings row that opens a bottom sheet of explanatory prose instead of
// navigating anywhere — used for "What your partner can see" (§7.12's
// trust artifact) and the Notifications row, neither of which is a
// workflow with its own screen.
export function InfoRowSheet({ title, danger = false, children }: { title: string; danger?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="flex w-full items-center justify-between rounded-card border border-hairline bg-white px-4 py-3.5 text-left"
        onClick={() => setOpen(true)}
        type="button"
      >
        <span className={`font-productive text-[15px] font-semibold ${danger ? "text-danger" : "text-ink"}`}>{title}</span>
        <span aria-hidden="true" className="text-muted">
          ›
        </span>
      </button>
      <Sheet onClose={() => setOpen(false)} open={open} title={title}>
        {children}
      </Sheet>
    </>
  );
}
