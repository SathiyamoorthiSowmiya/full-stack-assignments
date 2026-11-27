# Full Stack Assignments

| # | Task | Folder | Stack |
|---|------|--------|-------|
| 1 | Algorithm: Max Profit | [`max-profit`](max-profit) | JavaScript (Node.js) |
| 2 | Algorithm: Water Tank | [`water-tank`](water-tank) | Vanilla JavaScript, HTML, CSS, SVG |
| 3 | Backend: Meeting Room Booking Service | [`meeting-room-api`](meeting-room-api) | Node.js, Express, MongoDB |

Each folder has its own README with run instructions, approach and test details.

## Quick start

**Max Profit**
```bash
cd max-profit
node maxProfit.js
node maxProfit.test.js
```

**Water Tank**: open `water-tank/index.html` in a browser, or run the tests:
```bash
cd water-tank
node waterTank.test.js
```

**Meeting Room API**
```bash
cd meeting-room-api
npm install
npm test               # does not need MongoDB
cp .env.example .env   # Windows: copy .env.example .env, then set MONGODB_URI
npm start
```

## Highlights

- **Max Profit:** dynamic programming with memoization, returns every optimal combination.
- **Water Tank:** O(n) two-pass solution with a live SVG visualisation and input validation.
- **Meeting Room API:** layered architecture (routes, controllers, services, repositories), idempotent booking creation, per-room locking to prevent double booking, time zone aware working-hours rules, and a utilization report.

## Notes

No secrets are committed. The backend reads its MongoDB connection string from a local `.env` file (see `.env.example`).

