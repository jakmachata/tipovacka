"use client";

import { useEffect } from "react";

/**
 * Mobile/desktop browsers can hold onto old HTML pointing at chunks that no
 * longer exist after a deploy. When that happens, dynamic import() throws a
 * ChunkLoadError ("Loading chunk N failed"). Catching it once and doing a
 * single soft reload almost always recovers cleanly.
 *
 * sessionStorage flag prevents an infinite reload loop if something else
 * is broken.
 */
export function ChunkReloadHandler() {
  useEffect(() => {
    function isChunkErr(reason: unknown) {
      const msg =
        (reason as { message?: string })?.message ||
        String(reason ?? "");
      return /Loading chunk|ChunkLoadError|Loading CSS chunk/i.test(msg);
    }

    function tryReload() {
      try {
        if (sessionStorage.getItem("natipovals:chunkReloaded") === "1") return;
        sessionStorage.setItem("natipovals:chunkReloaded", "1");
        window.location.reload();
      } catch {
        // sessionStorage not available — still reload once per page lifetime.
        window.location.reload();
      }
    }

    function onError(e: ErrorEvent) {
      if (isChunkErr(e.error || e.message)) tryReload();
    }
    function onRejection(e: PromiseRejectionEvent) {
      if (isChunkErr(e.reason)) tryReload();
    }

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
