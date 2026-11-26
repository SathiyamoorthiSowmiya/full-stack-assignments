const assert = require("assert");
const { maxProfit } = require("./maxProfit");

const has = (sols, T, P, C) => sols.some((s) => s.T === T && s.P === P && s.C === C);

let r = maxProfit(7);
assert.strictEqual(r.earnings, 3000);
assert.strictEqual(r.solutions.length, 2);
assert(has(r.solutions, 1, 0, 0) && has(r.solutions, 0, 1, 0));

r = maxProfit(8);
assert.strictEqual(r.earnings, 4500);
assert(has(r.solutions, 1, 0, 0));

r = maxProfit(13);
assert.strictEqual(r.earnings, 16500);
assert(has(r.solutions, 2, 0, 0));

assert.strictEqual(maxProfit(4).earnings, 0);

console.log("All tests passed ✅");