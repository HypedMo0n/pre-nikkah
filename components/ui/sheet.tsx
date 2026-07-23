"use client";

import { AnimatePresence, motion, type PanInfo } from "motion/react";
import type { ReactNode } from "react";

// §9 #9. 400ms var(--ease-drawer), 1:1 drag, rubber-band past bounds (more
// give downward toward dismiss than upward), dismiss on a fast flick
// regardless of how far it travelled. Motion's drag gesture already calls
// setPointerCapture internally, so this needs no manual pointer handling.
//
// info.velocity is in px/s, so the spec's 0.11 px/ms threshold is 110 px/s.
// A flick can dismiss without much travel, but the spec doesn't rule out a
// slow deliberate full drag also dismissing, so a distance fallback
// (dragged more than a third of the sheet's own height) is added too —
// otherwise a slow full-length drag with low velocity would just snap back.
const VELOCITY_DISMISS_THRESHOLD = 110;
const DRAG_DISTANCE_DISMISS_RATIO = 0.33;

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  function handleDragEnd(_event: PointerEvent | MouseEvent | TouchEvent, info: PanInfo, sheetHeight: number) {
    const draggedDown = info.offset.y > 0;
    const fastFlick = Math.abs(info.velocity.y) > VELOCITY_DISMISS_THRESHOLD;
    const draggedFar = info.offset.y > sheetHeight * DRAG_DISTANCE_DISMISS_RATIO;
    if (draggedDown && (fastFlick || draggedFar)) {
      onClose();
    }
  }

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-40 bg-ink/30"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            onClick={onClose}
            transition={{ duration: 0.3 }}
          />
          <motion.div
            animate={{ y: 0 }}
            aria-label={title}
            aria-modal="true"
            className="safe-screen fixed inset-x-0 bottom-0 z-50 rounded-t-card border-t border-hairline bg-white px-6 pb-8 pt-3"
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.15, bottom: 0.5 }}
            exit={{ y: "100%" }}
            initial={{ y: "100%" }}
            onDragEnd={(event, info) =>
              handleDragEnd(event, info, (event.target as HTMLElement)?.offsetHeight ?? 320)
            }
            role="dialog"
            transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
          >
            <div aria-hidden="true" className="mx-auto mb-4 h-1 w-10 rounded-full bg-hairline" />
            {title ? (
              <h2 className="font-expressive text-xl font-normal text-ink">{title}</h2>
            ) : null}
            <div className={title ? "mt-4" : undefined}>{children}</div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
