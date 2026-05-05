// Časová zóna helper. Aplikace pracuje s časy v zóně Europe/Prague (CET/CEST),
// DB ukládá `timestamptz` v UTC. Tyhle helpery konvertují tam a zpět správně
// včetně letního času.

const PRAGUE = "Europe/Prague";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Pro daný UTC moment vrátí offset Europe/Prague v minutách (kladný = za UTC).
 * V květnu 2026 to bude +120 (CEST), v zimě +60 (CET).
 */
function pragueOffsetMinutes(utcDate: Date): number {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: PRAGUE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(utcDate).reduce<Record<string, string>>(
    (a, p) => {
      a[p.type] = p.value;
      return a;
    },
    {},
  );
  const pragueAsIfUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour === "24" ? "0" : parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return Math.round((pragueAsIfUTC - utcDate.getTime()) / 60000);
}

/**
 * Vezme datum/čas zadaný v Praze (yyyy, mm, dd, hh, mm) a vrátí
 * odpovídající UTC `Date` objekt.
 */
export function pragueLocalToUTC(
  yr: number,
  mo: number,
  da: number,
  hh: number,
  mm: number,
): Date {
  // Začneme s naivním UTC z těch komponent
  const naive = new Date(Date.UTC(yr, mo - 1, da, hh, mm, 0));
  // Najdeme, jaký offset má Praha v ten moment
  const offset = pragueOffsetMinutes(naive);
  // Skutečný UTC moment je naivní UTC mínus offset
  return new Date(naive.getTime() - offset * 60000);
}

/**
 * Z ISO stringu (UTC) vrátí komponenty (rok-měsíc-den, hodina:minuta) v Praze.
 */
export function pragueParts(iso: string): {
  date: string;
  time: string;
  full: string;
} {
  const d = new Date(iso);
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: PRAGUE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(d).reduce<Record<string, string>>(
    (a, p) => {
      a[p.type] = p.value;
      return a;
    },
    {},
  );
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  // hour 24 → 00 (Intl občas vrátí 24 pro půlnoc)
  const hour = parts.hour === "24" ? "00" : parts.hour;
  const time = `${hour}:${parts.minute}`;
  return { date, time, full: `${date} ${time}` };
}

/**
 * Server-safe formátování pro UI: "5. 5. 18:00".
 */
export function formatPraguePretty(iso: string): string {
  const { date, time } = pragueParts(iso);
  const [, mo, da] = date.split("-");
  return `${Number(da)}. ${Number(mo)}. ${time}`;
}

/**
 * Snap minut na nejbližší 5 (na typu number).
 */
export function snap5(mm: number): number {
  return Math.round(mm / 5) * 5 % 60;
}

export const _pad = pad;
