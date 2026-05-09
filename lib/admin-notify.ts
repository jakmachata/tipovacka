"use server";

const ADMIN_EMAIL = "jakubmachata88@gmail.com";

async function sendEmail(subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[admin-notify] RESEND_API_KEY not set, skipping email");
    return { error: "no_api_key" };
  }
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + apiKey,
      },
      body: JSON.stringify({
        from: "Natipovals <onboarding@resend.dev>",
        to: [ADMIN_EMAIL],
        subject,
        html,
      }),
    });
    if (!r.ok) {
      const txt = await r.text();
      console.error("[admin-notify] Resend error:", r.status, txt);
      return { error: "send_failed" };
    }
    return { ok: true };
  } catch (e) {
    console.error("[admin-notify] exception:", e);
    return { error: "exception" };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function notifyNewRegistration(email: string) {
  const safe = escapeHtml(email);
  return sendEmail(
    "Natipovals: nová registrace čeká na schválení",
    `<div style="font-family:sans-serif">
      <p>Nový uživatel <strong>${safe}</strong> se zaregistroval a čeká na schválení.</p>
      <p><a href="https://www.natipovals.cz/hraci">Otevřít Hráče</a></p>
    </div>`,
  );
}

export async function notifyLateTip(displayName: string, matchId: number) {
  const safeName = escapeHtml(displayName);
  return sendEmail(
    "Natipovals: pozdní tip čeká na schválení",
    `<div style="font-family:sans-serif">
      <p><strong>${safeName}</strong> poslal pozdní tip pro zápas #${matchId} a čeká na schválení.</p>
      <p><a href="https://www.natipovals.cz/admin/pending">Otevřít Pozdní tipy</a></p>
    </div>`,
  );
}
