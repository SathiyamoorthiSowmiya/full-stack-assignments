const BUILDINGS = [
  { key: "T", name: "Theatre", buildTime: 5, rate: 1500 },
  { key: "P", name: "Pub", buildTime: 4, rate: 1000 },
  { key: "C", name: "Commercial Park", buildTime: 10, rate: 2000 },
];

function maxProfit(n) {
  const memo = new Map();

  function best(t) {
    if (memo.has(t)) return memo.get(t);

    let profit = 0;
    let combos = new Map([["0,0,0", { T: 0, P: 0, C: 0 }]]);

    for (const b of BUILDINGS) {
      const done = t + b.buildTime;
      if (done >= n) continue;

      const own = (n - done) * b.rate;
      const next = best(done);
      const total = own + next.profit;

      if (total < profit) continue;
      if (total > profit) {
        profit = total;
        combos = new Map();
      }
      for (const c of next.combos.values()) {
        const merged = { ...c, [b.key]: c[b.key] + 1 };
        combos.set(`${merged.T},${merged.P},${merged.C}`, merged);
      }
    }

    const result = { profit, combos };
    memo.set(t, result);
    return result;
  }

  const { profit, combos } = best(0);
  return { earnings: profit, solutions: [...combos.values()] };
}

function format(n) {
  const { earnings, solutions } = maxProfit(n);
  const lines = [`Time Unit: ${n}`, `Earnings: $${earnings}`, "Solutions"];
  solutions.forEach((s, i) =>
    lines.push(`${i + 1}. T: ${s.T} P: ${s.P} C: ${s.C}`),
  );
  return lines.join("\n");
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { maxProfit, format };

  if (require.main === module) {
    const inputs = process.argv.slice(2).map(Number);
    (inputs.length ? inputs : [7, 8, 13]).forEach((n) =>
      console.log(format(n) + "\n"),
    );
  }
} else {
  window.MaxProfit = { maxProfit, format };
}
