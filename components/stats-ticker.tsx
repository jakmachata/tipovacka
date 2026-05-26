"use client";

import { useEffect, useState } from "react";

export interface TickerCard {
  icon: string;
  title: string;
  body: string;
  avgNote?: string;
}

export function StatsTicker({ cards }: { cards: TickerCard[] }) {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (cards.length <= 1) return;
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx((i) => (i + 1) % cards.length);
        setVisible(true);
      }, 400);
    }, 9000);
    return () => clearInterval(interval);
  }, [cards.length]);

  if (cards.length === 0) return null;
  const c = cards[idx];

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-3 py-1.5">
      <div
        className={
          "truncate text-base text-amber-900 transition-opacity duration-300 " +
          (visible ? "opacity-100" : "opacity-0")
        }
        title={`${c.icon} ${c.title}: ${c.body}`}
      >
        <span className="mr-1.5 text-xl">{c.icon}</span>
        <strong className="font-semibold">{c.title}</strong>
        {c.avgNote && (
          <span className="ml-1 italic text-amber-700">{c.avgNote}</span>
        )}
        <span className="mx-1.5 text-amber-600">:</span>
        <span>{c.body}</span>
      </div>
    </div>
  );
}
