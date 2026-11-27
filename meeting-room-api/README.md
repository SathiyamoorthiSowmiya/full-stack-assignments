# Meeting Room Booking Service

REST API for rooms and bookings. Node.js, Express and MongoDB (Mongoose), plain JavaScript.
See [DESIGN.md](DESIGN.md) for the data model, overlap handling, idempotency, concurrency and the utilization formula.

🔗 Live API: https://meeting-room-api-ge8u.onrender.com/

## Run

You need Node 18+ and a MongoDB (local, or a free MongoDB Atlas cluster).

```bash
npm install
cp .env.example .env      # on Windows: copy .env.example .env
# edit .env and set MONGODB_URI if you are not using a local MongoDB
npm start
```

The API listens on `http://localhost:3000`. `npm run dev` restarts on file changes.

## Tests

```bash
npm test
```

The tests use in-memory repositories, so **they do not need MongoDB**. They cover:

- unit tests: overlap, duration, working hours (including time zones), utilization maths
- integration tests (HTTP, via supertest): rooms, bookings happy path and conflict, validation, cancellation cut-off, pagination, report
- idempotency: same key returns the same booking, concurrent requests, different body, per-organizer keys, restart, crashed request
- concurrency: only one of many parallel bookings for the same slot succeeds

To also run the repository tests against a real MongoDB (use a throwaway database):

```bash
MONGODB_URI_TEST=mongodb://127.0.0.1:27017/meeting-rooms-test npm test        # macOS / Linux
set MONGODB_URI_TEST=mongodb://127.0.0.1:27017/meeting-rooms-test && npm test # Windows cmd
```

## Endpoints

| Method | Path | |
|---|---|---|
| POST | `/rooms` | create a room |
| GET | `/rooms?minCapacity=&amenity=` | list rooms |
| POST | `/bookings` | create a booking (optional `Idempotency-Key` header) |
| GET | `/bookings?roomId=&from=&to=&limit=&offset=` | list bookings |
| POST | `/bookings/:id/cancel` | cancel up to 1 hour before start |
| GET | `/reports/room-utilization?from=&to=` | utilization per room |

## Try it

```bash
curl -X POST localhost:3000/rooms -H "Content-Type: application/json" \
  -d '{"name":"Orion","capacity":10,"floor":3,"amenities":["tv","whiteboard"],"timezone":"Asia/Kolkata"}'

curl -X POST localhost:3000/bookings -H "Content-Type: application/json" -H "Idempotency-Key: demo-1" \
  -d '{"roomId":"<id from above>","title":"Sprint planning","organizerEmail":"asha@example.com","startTime":"2030-01-07T10:00:00","endTime":"2030-01-07T11:00:00"}'

curl "localhost:3000/reports/room-utilization?from=2030-01-07&to=2030-01-11"
```

Error responses always look like `{ "error": "ValidationError", "message": "startTime must be before endTime" }`.

## Project layout

```
src/
  app.js              routes
  controllers/        request -> service -> response
  services/           business logic
  domain/             pure rules (overlap, hours, utilization, lock)
  repositories/       mongo/ and memory/
  validation.js       input validation
  middleware/         error handling
tests/
```
