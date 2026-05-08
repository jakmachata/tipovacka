"use client";

interface Props {
  id: string;
  email: string;
  displayName: string | null;
  isDummy: boolean;
  action: (fd: FormData) => void | Promise<void>;
}

/**
 * Klient component pro tlačítko Smazat hráče v /hraci.
 * - Dummy účty (`@tipovacka.local`): klik = okamžité smazání bez potvrzení (používá se k úklidu testovacích účtů).
 * - Non-dummy: vyžadujeme JS confirm() s plným jménem + emailem, aby Master nemazal omylem.
 */
export function DeleteAccountButton({ id, email, displayName, isDummy, action }: Props) {
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (isDummy) return; // skip confirm pro dummy
    const ok = confirm(
      `Opravdu smazat účet?\n\nPřezdívka: ${displayName ?? "(neznámá)"}\nEmail: ${email}\n\nTato akce smaže profil, všechny tipy a celou historii. Nelze vrátit zpět.`,
    );
    if (!ok) e.preventDefault();
  }

  return (
    <form action={action} onSubmit={onSubmit} className="inline">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="email" value={email} />
      <button
        title={isDummy ? "Smazat dummy účet" : "Smazat účet (s potvrzením)"}
        className="rounded bg-rose-100 px-1.5 py-0.5 text-xs text-rose-700 hover:bg-rose-200"
      >
        🗑️
      </button>
    </form>
  );
}
