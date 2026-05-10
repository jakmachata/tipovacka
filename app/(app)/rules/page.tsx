export default function RulesPage() {
  return (
    <main className="prose max-w-none">
      <h2 className="mt-2 mb-2 text-lg font-semibold">Handicap</h2>
      <p>
        Tip vyplníš jako finální skóre po 60. min. Strana, na kterou „vsadíš",
        se odvodí ze tvého rozdílu skóre a handicapu domácích.
      </p>
      <p className="mt-2 text-sm text-neutral-600">
        Příklad: Finsko -3.5 vs Rakousko +3.5.
        <br />
        Tip 6:1 = jdeš s Finskem (potřebuješ výhru o 4+). Tip 4:1 = jdeš s Rakouskem (musí vyhrát nebo prohrát max o 3).
      </p>

      <h2 className="mt-6 mb-2 text-lg font-semibold">Bodování - handicap</h2>
      <table className="mt-2 text-sm">
        <thead>
          <tr><th className="pr-6 text-left">Fáze</th><th className="text-left">Body</th></tr>
        </thead>
        <tbody>
          <tr><td className="pr-6">Skupina (zápas Česka)</td><td>3</td></tr>
          <tr><td className="pr-6">Skupina (ostatní)</td><td>1</td></tr>
          <tr><td className="pr-6">Předkolo / čtvrtfinále</td><td>2</td></tr>
          <tr><td className="pr-6">Semifinále</td><td>3</td></tr>
          <tr><td className="pr-6">Bronz / finále</td><td>4</td></tr>
        </tbody>
      </table>

      <h2 className="mt-6 mb-2 text-lg font-semibold">Bonusy</h2>
      <ul className="list-disc pl-6">
        <li><strong>+4 body</strong> za přesný výsledek po 60. minutě.</li>
        <li><strong>+1 bod</strong> za přesný výsledek po 1. třetině.</li>
      </ul>
      <p className="mt-2 text-sm text-neutral-600">
        Maximum z jednoho zápasu = 4 (handicap medailového zápasu) + 4 (přesný 60′) + 1
        (1. třetina) = <strong>9 bodů</strong>.
      </p>

      <h2 className="mt-6 mb-2 text-lg font-semibold">Bank</h2>
      <ul className="list-disc pl-6">
        <li>Vstup: 300 Kč zaplaceno předem.</li>
        <li>1. místo: 60 % banku · 2. místo: 25 % · 3. místo: 15 %.</li>
        <li>Při shodě míst se výhra na daném místě dělí rovným dílem.</li>
      </ul>
    </main>
  );
}
