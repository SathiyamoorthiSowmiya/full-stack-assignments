// Pure logic for the Water Tank problem (no DOM) so it can be unit-tested in Node.
(function (root) {
  const MAX_BARS = 40;
  const MAX_HEIGHT = 30;

  /**
   * For every bar, water held above it = min(tallest bar to its left,
   * tallest bar to its right) - its own height.
   * Two passes build the "tallest so far" arrays, so this runs in O(n).
   */
  function computeWater(heights) {
    const n = heights.length;
    const leftMax = new Array(n);
    const rightMax = new Array(n);

    let run = 0;
    for (let i = 0; i < n; i++) {
      run = Math.max(run, heights[i]);
      leftMax[i] = run;
    }
    run = 0;
    for (let i = n - 1; i >= 0; i--) {
      run = Math.max(run, heights[i]);
      rightMax[i] = run;
    }

    const water = heights.map((h, i) => Math.min(leftMax[i], rightMax[i]) - h);
    const total = water.reduce((sum, w) => sum + w, 0);
    return { water, total };
  }

  /**
   * Turns "0,4,0,0,0,6,0,6,4,0" (brackets / spaces allowed) into numbers.
   * Heights must be whole numbers >= 0, as the problem says n is always > -1.
   */
  function parseHeights(text) {
    const cleaned = String(text).replace(/[\[\]]/g, " ").trim();
    if (cleaned === "") {
      return { ok: false, error: "Enter at least one block height, for example 0,4,0,0,0,6,0,6,4,0." };
    }

    const parts = cleaned.split(/[\s,]+/).filter(Boolean);
    const values = [];
    for (const part of parts) {
      if (!/^\d+$/.test(part)) {
        return { ok: false, error: `"${part}" is not valid. Use whole numbers that are 0 or higher, separated by commas.` };
      }
      values.push(Number(part));
    }

    if (values.length > MAX_BARS) {
      return { ok: false, error: `Use at most ${MAX_BARS} blocks so the tank stays readable.` };
    }
    if (Math.max(...values) > MAX_HEIGHT) {
      return { ok: false, error: `Keep each height at ${MAX_HEIGHT} or lower so the tank fits on screen.` };
    }
    return { ok: true, values };
  }

  const api = { computeWater, parseHeights, MAX_BARS, MAX_HEIGHT };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.WaterTank = api;
})(typeof window !== "undefined" ? window : globalThis);