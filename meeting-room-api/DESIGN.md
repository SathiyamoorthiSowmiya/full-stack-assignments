# Design notes

## Layers

```
routes (src/app.js)          URL -> controller, nothing else
controllers (src/controllers) read the request, call a service, shape the response
services (src/services)       business rules, orchestration, idempotency
domain (src/domain)           pure functions: overlap, duration, working hours, utilization
repositories (src/repositories)  persistence. mongo/ for production, memory/ for tests
```

Services only talk to repository objects passed in through `src/container.js`. Production uses the Mongo repositories, tests use in-memory ones with the same behaviour, and `tests/repositories.contract.test.js` runs the same checks against both (Mongo too when `MONGODB_URI_TEST` is set).

## Data model

**rooms**
| field | notes |
|---|---|
| name | as entered |
| nameLower | lower-cased copy, **unique index** |
| capacity (int >= 1), floor (int), amenities (string[]) | |
| timezone | IANA name, default from `DEFAULT_TIMEZONE` (UTC). The spec says "room's local time" but has no field for it, so I added an optional one. |

**bookings**
| field | notes |
|---|---|
| roomId | |
| title, organizerEmail (lower-cased) | |
| startTime, endTime | stored as UTC dates |
| status | `confirmed` or `cancelled` |
| idempotencyKey | the key that created it, if any |
| createdAt, cancelledAt | |

Index: `(roomId, status, startTime, endTime)` for the overlap query.

**idempotencykeys**
| field | notes |
|---|---|
| organizerEmail, key | **unique index** on the pair |
| requestHash | SHA-256 of the normalised request body |
| status | `in_progress` or `completed` |
| bookingId | set when completed |
| createdAt | used to detect crashed requests |

## Time handling

- Times with an offset (`...Z`, `+05:30`) are used as given. Times without one (`2030-01-07T10:00:00`) are read as the room's local time.
- Responses return UTC ISO strings.
- Working hours are checked in the room's time zone: Monday to Friday, start >= 08:00, end <= 20:00, and start and end on the same local day. A booking that ends exactly at 20:00 is allowed.
- Duration must be 15 minutes to 4 hours, both ends included.

## How overlaps are prevented

Two bookings overlap when `a.start < b.end && a.end > b.start`. Back-to-back bookings (one ends at 11:00, the next starts at 11:00) are allowed.

Creating a booking does, per room, one after the other:
1. query confirmed bookings of that room that overlap the new interval
2. if any exist, answer 409
3. otherwise insert

Steps 1 to 3 run inside a per-room in-memory lock (`KeyedMutex`), so two requests for the same room cannot interleave between "check" and "insert". Different rooms do not block each other.

Cancelled bookings are never returned by the overlap query, so they do not block new bookings.

**Limitation:** the lock lives in one Node process. If the API is scaled to several instances, two instances could both pass the check. The fix would be a database-level guarantee, for example a Mongo transaction (needs a replica set) that also writes a per-room "version" document so concurrent writers conflict, or moving to a database with exclusion constraints (PostgreSQL `EXCLUDE USING gist` on a time range). I kept the in-memory lock because the assignment lists it as acceptable when its limits are explained.

`tests/bookings.test.js` ("concurrency: the per-room lock") uses a deliberately slow repository to widen the gap between check and insert. It fails if the lock is removed.

## Idempotency

`POST /bookings` with an `Idempotency-Key` header.

- **Scope:** keys are unique **per organizer** (`organizerEmail` + key). Two organizers can use the same key string independently.
- **Persistence:** keys live in the `idempotencykeys` collection, so they survive restarts.
- **Request fingerprint:** a SHA-256 hash of `roomId, title, organizerEmail, startTime, endTime`. Reusing a key with a different body returns **422** `IdempotencyKeyReuse`.

Flow:
1. **Claim** the key by inserting `(organizerEmail, key, status = in_progress)`. The unique index makes this atomic, so exactly one of several concurrent requests wins.
2. The winner runs the normal booking logic. On success it marks the key `completed` and stores the booking id.
3. A request that did not win:
   - key `completed` -> returns the stored booking (status 201, header `Idempotent-Replayed: true`). No second booking is created.
   - key `in_progress` -> polls (default every 25 ms, up to 5 s) until the first request finishes, then returns its booking. If it is still running after 5 s it answers 409 "still being processed, retry shortly".
   - key gone (the first request failed and released it) -> tries to claim it itself.
4. **Failures are not remembered.** If the winner fails (400, 404, 409...), it deletes the `in_progress` key so the client can retry with the same key after fixing the problem. This matches the spec ("if a request has already *succeeded*...").
5. **Crash recovery:** if a process dies after claiming, the key stays `in_progress`. After 30 s it is treated as stale and one new request takes it over atomically. Before creating anything, the new owner looks for a booking already saved with that key (`bookings.idempotencyKey`) and reuses it, so a crash between "booking saved" and "key completed" never produces a duplicate.

The 30 s stale limit is much longer than a normal request. A request slower than that could be taken over while still running, but the per-room lock and overlap check would still stop a double booking.

## Concurrency summary

| Risk | Protection |
|---|---|
| Same key sent twice at once | unique index on (organizerEmail, key); losers wait and replay |
| Two requests book the same slot | per-room lock around check + insert (single process) |
| Duplicate room names at once | unique index on `nameLower` |
| Cancelling twice at once | conditional update `status = confirmed -> cancelled`; second call returns the booking as it is |

## Error handling

Every error has the same JSON shape: `{ "error": "<Name>", "message": "<what went wrong>" }`.

| Status | error | When |
|---|---|---|
| 400 | ValidationError | bad body or query, broken time rules, cancelling too late, invalid JSON |
| 404 | NotFoundError | unknown room, unknown booking, unknown route |
| 409 | ConflictError | overlapping booking, duplicate room name, key still in progress |
| 422 | IdempotencyKeyReuse | same key, different body |
| 500 | InternalServerError | anything unexpected (details are logged, not returned) |

Services throw typed errors (`src/errors.js`); one error middleware turns them into responses. Controllers never build error responses themselves. Validation collects all problems in a body and reports them together, for example `capacity must be an integer of at least 1; floor must be an integer`.

Decisions where the spec was silent:
- Duplicate room name -> 409 (it conflicts with existing data), not 400.
- Cancelling less than 1 hour before start, or after it started -> 400 as specified. Exactly 1 hour before is still allowed.
- Cancelling an already cancelled booking returns it with 200, even past the cut-off.

## Booking list filters

`from` / `to` return bookings that **overlap** the range (`end > from` and `start < to`), ordered by start time. A date-only `to` (`2030-01-11`) includes that whole day. `limit` defaults to 20 (max 100), `offset` to 0.

## Room utilization

```
utilization = booked hours in [from, to] / business hours in [from, to]
```

- **Booked hours:** confirmed bookings only. Each booking is clipped to the range, so one that starts before `from` or ends after `to` counts only the part inside.
- **Business hours:** for every day in the range in the **room's time zone**, Monday to Friday, the overlap of 08:00-20:00 with the range. A full week is 5 x 12 = 60 hours; weekends add nothing.
- If the range has no business hours (for example only a weekend) utilization is `0`, not a division by zero.
- `utilizationPercent` is a **fraction from 0 to 1** (0.45 means 45%), following the example in the assignment.
- `totalBookingHours` is rounded to 2 decimals, `utilizationPercent` to 4.
- `from` and `to` without an offset are read in each room's own time zone. A date-only `to` includes that day. The range may not be longer than 366 days.
- The report runs one query per room. Fine for an office; for thousands of rooms a single aggregation would be better.
