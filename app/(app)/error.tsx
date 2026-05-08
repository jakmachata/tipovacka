"use client";

import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[app error]", error);
  }, [error]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="mb-2 text-2xl font-semibold text-rose-700">Něco se pokazilo</h1>
      <p className="mb-4 text-sm text-neutral-600">
        Pošli prosím tenhle text Kubovi (skopírováním celého boxu):
      </p>
      <pre className="mb-4 max-h-96 overflow-auto rounded bg-neutral-100 p-3 text-xs">
        {error?.message || "(no message)"}
        {error?.digest ? `\n\ndigest: ${error.digest}` : ""}
        {error?.stack ? `\n\n${error.stack}` : ""}
      </pre>
      <div className="flex gap-2">
        <button
          onClick={() => reset()}
          className="rounded bg-black px-4 py-2 text-sm text-white"
        >
          Zkusit znovu
        </button>
        <a
          href="/login"
          className="rounded border px-4 py-2 text-sm hover:bg-neutral-50"
        >
          Na přihlášení
        </a>
      </div>
    </main>
  );
}
