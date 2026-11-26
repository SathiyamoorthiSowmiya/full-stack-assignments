(function () {
  const { computeWater, parseHeights } = window.WaterTank;

  const CELL = 40;       // size of one unit in SVG coordinates
  const PAD = 10;
  const LABEL_LIMIT = 24; // hide number labels when the tank gets too wide

  const form = document.getElementById("controls");
  const input = document.getElementById("heights");
  const errorEl = document.getElementById("error");
  const totalEl = document.getElementById("total");
  const unitEl = document.getElementById("unit");
  const svg = document.getElementById("tank");

  function drawTank(heights, water) {
    const n = heights.length;
    const maxH = Math.max(...heights.map((h, i) => h + water[i]), 1);
    const width = n * CELL + PAD * 2;
    const height = maxH * CELL + PAD * 2;
    const groundY = PAD + maxH * CELL;
    const showLabels = n <= LABEL_LIMIT;

    let out = "";

    // Water first so the grid lines sit on top of everything
    heights.forEach((h, i) => {
      const x = PAD + i * CELL;
      if (water[i] > 0) {
        const top = groundY - (h + water[i]) * CELL;
        out += `<rect class="svg-water svg-water-col" x="${x}" y="${top}" width="${CELL}" height="${water[i] * CELL}"/>`;
        if (showLabels) {
          out += `<text class="svg-label-water" x="${x + CELL / 2}" y="${top + (water[i] * CELL) / 2 + 5}">${water[i]}</text>`;
        }
      }
    });

    heights.forEach((h, i) => {
      const x = PAD + i * CELL;
      if (h > 0) {
        out += `<rect class="svg-block" x="${x}" y="${groundY - h * CELL}" width="${CELL}" height="${h * CELL}"/>`;
        if (showLabels) {
          out += `<text class="svg-label-block" x="${x + CELL / 2}" y="${groundY - h * CELL + 25}">${h}</text>`;
        }
      }
    });

    // Unit grid lines
    for (let c = 0; c <= n; c++) {
      const x = PAD + c * CELL;
      out += `<line class="svg-grid" x1="${x}" y1="${PAD}" x2="${x}" y2="${groundY}"/>`;
    }
    for (let r = 0; r <= maxH; r++) {
      const y = PAD + r * CELL;
      out += `<line class="svg-grid" x1="${PAD}" y1="${y}" x2="${PAD + n * CELL}" y2="${y}"/>`;
    }

    out += `<line class="svg-ground" x1="${PAD}" y1="${groundY}" x2="${PAD + n * CELL}" y2="${groundY}"/>`;

    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.innerHTML = out;
  }

  function update() {
    const parsed = parseHeights(input.value);

    if (!parsed.ok) {
      errorEl.textContent = parsed.error;
      input.setAttribute("aria-invalid", "true");
      return;
    }

    errorEl.textContent = "";
    input.removeAttribute("aria-invalid");

    const { water, total } = computeWater(parsed.values);
    totalEl.textContent = total;
    unitEl.textContent = total === 1 ? "unit" : "units";
    svg.setAttribute("aria-label", `Tank with ${parsed.values.length} blocks holding ${total} units of water`);
    drawTank(parsed.values, water);
  }

  function randomHeights() {
    const count = 8 + Math.floor(Math.random() * 7);
    return Array.from({ length: count }, () => Math.floor(Math.random() * 9)).join(",");
  }

  form.addEventListener("submit", (e) => { e.preventDefault(); update(); });
  input.addEventListener("input", update);
  document.getElementById("example").addEventListener("click", () => {
    input.value = "0,4,0,0,0,6,0,6,4,0";
    update();
  });
  document.getElementById("random").addEventListener("click", () => {
    input.value = randomHeights();
    update();
  });

  update();
})();