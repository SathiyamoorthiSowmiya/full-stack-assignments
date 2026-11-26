const assert = require("assert");
const { computeWater, parseHeights } = require("./waterTank");

// Example from the assignment PDF
assert.strictEqual(computeWater([0, 4, 0, 0, 0, 6, 0, 6, 4, 0]).total, 18);
assert.deepStrictEqual(computeWater([0, 4, 0, 0, 0, 6, 0, 6, 4, 0]).water, [0, 0, 4, 4, 4, 0, 6, 0, 0, 0]);

// Edge cases
assert.strictEqual(computeWater([]).total, 0);
assert.strictEqual(computeWater([5]).total, 0);
assert.strictEqual(computeWater([1, 2, 3, 4]).total, 0);   // ascending: nothing trapped
assert.strictEqual(computeWater([4, 3, 2, 1]).total, 0);   // descending: nothing trapped
assert.strictEqual(computeWater([3, 0, 3]).total, 3);
assert.strictEqual(computeWater([2, 0, 2, 0, 2]).total, 4);
assert.strictEqual(computeWater([0, 0, 0]).total, 0);

// Parsing
assert.deepStrictEqual(parseHeights("[0, 4, 0 ,6]").values, [0, 4, 0, 6]);
assert.deepStrictEqual(parseHeights("1 2 3").values, [1, 2, 3]);
assert.strictEqual(parseHeights("").ok, false);
assert.strictEqual(parseHeights("1,-2,3").ok, false);   // negatives rejected
assert.strictEqual(parseHeights("1,a,3").ok, false);
assert.strictEqual(parseHeights("1.5,2").ok, false);
assert.strictEqual(parseHeights("99").ok, false);       // too tall to draw

console.log("All tests passed ✅");