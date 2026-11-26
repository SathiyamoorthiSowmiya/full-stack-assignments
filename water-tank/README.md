# Water Tank (Vanilla JS)

Given block heights, computes how many units of water are trapped between the blocks and draws the result as an SVG.

## Run
Open `index.html` in a browser. No build step, no dependencies.

## Tests
```bash
node waterTank.test.js
```

## Approach
For each block, water held above it = `min(tallest block to the left, tallest block to the right) - its own height`.
Two passes build the left and right "tallest so far" arrays, so the solution is O(n) time and O(n) space.
Example `[0,4,0,0,0,6,0,6,4,0]` gives 18 units.

## Files
- `waterTank.js`: pure logic (compute + input parsing), testable in Node
- `app.js`: reads input, draws the SVG
- `style.css`, `index.html`: layout and styling