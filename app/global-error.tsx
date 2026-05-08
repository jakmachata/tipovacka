"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[global error]", error);
  }, [error]);

  return (
    <html>
      <body style={{ fontFamily: "system-ui, sans-serif", padding: 24, maxWidth: 700, margin: "0 auto" }}>
        <h1 style={{ color: "#be123c", marginBottom: 8 }}>Něco se pokazilo (global)</h1>
        <p style={{ color: "#525252", marginBottom: 16 }}>
          Pošli prosím tenhle text Kubovi:
        </p>
        <pre
          style={{
            background: "#f5f5f5",
            padding: 12,
            borderRadius: 4,
            fontSize: 12,
            maxHeight: 400,
            overflow: "auto",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {error?.message || "(no message)"}
          {error?.digest ? `\n\ndigest: ${error.digest}` : ""}
          {error?.stack ? `\n\n${error.stack}` : ""}
        </pre>
        <button
          onClick={() => reset()}
          style={{
            marginTop: 16,
            background: "black",
            color: "white",
            padding: "8px 16px",
            border: 0,
            borderRadius: 4,
          }}
        >
          Zkusit znovu
        </button>
      </body>
    </html>
  );
}
