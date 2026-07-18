"use client";

import { Camera, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { formatInviteCode, invitationPath, isInviteCode, normalizeInviteCode } from "@/features/invites/invite-code";
import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

function codeFromQrPayload(payload: string) {
  try {
    const url = new URL(payload, window.location.origin);
    const match = url.pathname.match(/^\/(?:en|fr)\/join\/([0-9a-f]{20})$/i);
    return match?.[1] ? normalizeInviteCode(match[1]) : null;
  } catch {
    return null;
  }
}

export function JoinCodeForm({ locale }: { locale: Locale }) {
  const d = getDictionary(locale);
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<{ destroy: () => void; start: () => Promise<void>; stop: () => void } | null>(null);

  useEffect(() => () => scannerRef.current?.destroy(), []);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!isInviteCode(code)) {
      setError(d["join.unavailable"]);
      return;
    }
    router.push(invitationPath(locale, code));
  }

  async function startScanner() {
    if (!videoRef.current) return;
    setError(undefined);
    try {
      const QrScanner = (await import("qr-scanner")).default;
      const scanner = new QrScanner(
        videoRef.current,
        (result) => {
          const scannedCode = codeFromQrPayload(result.data);
          if (!scannedCode) {
            setError(d["join.unavailable"]);
            return;
          }
          scanner.stop();
          setScanning(false);
          router.push(invitationPath(locale, scannedCode));
        },
        { highlightScanRegion: true, returnDetailedScanResult: true },
      );
      scannerRef.current = scanner;
      setScanning(true);
      await scanner.start();
    } catch {
      setScanning(false);
      setError(d["join.scanUnavailable"]);
    }
  }

  function stopScanner() {
    scannerRef.current?.stop();
    setScanning(false);
  }

  return (
    <div className="mt-7 space-y-5">
      <form className="space-y-3" onSubmit={submit}>
        <label className="block text-sm font-semibold text-ink" htmlFor="invite-code">{d["join.codeLabel"]}</label>
        <input
          aria-describedby={error ? "invite-code-error" : undefined}
          autoCapitalize="characters"
          autoComplete="one-time-code"
          className="min-h-12 w-full rounded-productive border bg-card px-4 font-mono text-lg tracking-widest text-ink outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
          id="invite-code"
          inputMode="text"
          maxLength={24}
          onChange={(event) => setCode(formatInviteCode(event.target.value))}
          placeholder={d["join.codePlaceholder"]}
          value={code}
        />
        {error && <p className="text-sm text-concern" id="invite-code-error" role="alert">{error}</p>}
        <Button className="w-full" type="submit">{d["join.inspect"]}</Button>
      </form>
      <div className="relative flex items-center" role="separator"><span className="h-px flex-1 bg-border" /><span className="px-3 text-xs uppercase tracking-wider text-ink-soft">QR</span><span className="h-px flex-1 bg-border" /></div>
      <div className={scanning ? "block" : "hidden"}>
        <video aria-label={d["join.scan"]} className="aspect-square w-full rounded-expressive bg-ink object-cover" muted playsInline ref={videoRef} />
      </div>
      <Button className="w-full" onClick={scanning ? stopScanner : startScanner} variant="secondary">
        {scanning ? <X aria-hidden="true" size={18} /> : <Camera aria-hidden="true" size={18} />}
        {scanning ? d["join.stopScan"] : d["join.scan"]}
      </Button>
    </div>
  );
}
