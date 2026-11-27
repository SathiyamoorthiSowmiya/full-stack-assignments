# Max Profit (Mars Land)

Given `n` units of time, decide which buildings to build to earn the most money.

## The rules

| Building | Build time | Earnings per time unit |
|----------|-----------|------------------------|
| Theatre (T) | 5 | $1500 |
| Pub (P) | 4 | $1000 |
| Commercial Park (C) | 10 | $2000 |

- Only one building can be built at a time.
- A building starts earning the moment it is finished and keeps earning until time `n` ends.
- Earnings of a building = `(n - completion time) x rate`.

## Run

Requires Node.js. No dependencies.

```bash
node maxProfit.js          # runs the sample inputs 7, 8 and 13
node maxProfit.js 20 25    # your own inputs
node maxProfit.test.js     # tests
```

## Example

```
Time Unit: 7
Earnings: $3000
Solutions
1. T: 1 P: 0 C: 0
2. T: 0 P: 1 C: 0
```

## Test cases

| n | Earnings | Solution(s) |
|---|----------|-------------|
| 7 | $3000 | 1 Theatre, or 1 Pub |
| 8 | $4500 | 1 Theatre |
| 13 | $16500 | 2 Theatres |
| 4 | $0 | nothing fits |

## Approach

Dynamic programming with memoization on the current time `t`:

```
best(t) = max over each building b that finishes before n:
            (n - (t + buildTime)) x rate  +  best(t + buildTime)
```

- Each state (a point in time) is computed once and cached, so the number of states is `n`, each checking 3 buildings.
- Each state also keeps **all** optimal combinations, because the assignment shows more than one valid answer for some inputs (for example `n = 7`).
- A building that would finish at or after time `n` earns nothing, so it is ignored.

## Files

- `maxProfit.js`: solution and command line runner
- `maxProfit.test.js`: tests