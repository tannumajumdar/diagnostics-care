# MongoDB → PostgreSQL

The backend used MongoDB through Mongoose. It now uses PostgreSQL through
Prisma. The API is unchanged: every route takes and returns the same JSON as
before, down to `_id`, the nested `{ userId, name }` objects and the order of
lists. This folder holds what moves an existing installation across and what
proved the two backends answer alike.

## What is where

| | |
|---|---|
| `prisma/schema.prisma` | The tables. One per former collection, plus child tables for the arrays that were embedded in documents (bill lines, payment splits, status history, parameters, result lines). |
| `prisma/migrations/` | The SQL that creates them, with the `gen_object_id()` function and the `CHECK` constraints for every former Mongoose `enum`. |
| `src/db/` | The data layer the services use. `mappers.ts` turns rows into the old document JSON and back, `rules.ts` applies the old Mongoose schema rules (defaults, trim/uppercase, casting, validation - same messages), `repo.ts` is `findById` / `create` / `findByIdAndUpdate` / `save` on top of both. |
| `migration/` | This folder: the one-off data import and the verification tools. Not part of the build. |

Some things were kept on purpose so nothing downstream notices the switch:

- **Ids are still 24-hex ObjectIds.** Imported rows keep their Mongo id; new
  rows get one from `gen_object_id()`, time-ordered like Mongo's.
- **Numbers are `numeric`, not `float`.** Prisma rounds a `Float` to 16
  significant digits; billing arithmetic produces doubles such as
  `227.67000000000002` that need 17. `numeric` stores the exact value, and
  `src/db/mappers.ts` hands it back as the same JS number.
- **Natural order is a column.** Mongo returns unsorted queries, and rows that
  tie on a sort, in insertion order. Every table has `insertOrder` for that.
- **Enum values are the old strings** (`'Pending Collection'`, `'In-house'`),
  checked by the database rather than mapped to identifiers.

## Setting up PostgreSQL

PostgreSQL 14 or newer. Create the database as **UTF8 with the C collation** -
Mongo sorted text by code point and so does `C`; any other locale reorders
every sorted list:

```sql
CREATE DATABASE lms_db ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0;
```

Point the backend at it in `backend/.env`:

```
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/lms_db?schema=public
```

Then create the tables:

```
cd backend
npm install
npm run db:migrate
```

## Moving an existing MongoDB across

1. **Stop the backend** so nothing writes to Mongo while it is copied, and take
   a backup of it (`mongodump`).
2. **Dry run.** Reads every collection and reports anything Postgres would
   refuse - mostly references to records that no longer exist, which Mongo
   never checked. Nothing is written.

   ```
   npm run db:import-mongo -- lms_db --check
   ```

   If it lists problems, decide what each reference should be, fix it in
   Mongo, and run it again. The import refuses to drop anything silently.
3. **Import** into the empty, migrated database (one transaction - all or
   nothing):

   ```
   npm run db:import-mongo -- lms_db
   ```

   The Mongo host defaults to `mongodb://127.0.0.1:27017`; set `MONGO_HOST`
   for another.
4. **Verify.** Every document is read through Mongoose and compared field by
   field with what the app now builds from Postgres:

   ```
   npm run db:verify-import -- lms_db
   ```

   It should end with `Every document round-trips.`
5. Start the backend. MongoDB is no longer needed by the app; keep the backup.

## How it was verified

- **`roundtrip-check.ts`** - every stored document equals its Postgres row
  read back (above).
- **`rules-check.ts`** - `src/db/rules.ts` against Mongoose's own
  `validateSync()` on every document and thousands of damaged copies: same
  failing paths, same messages, same cleaned values.
- **`parity/`** - runs the same ~440 API requests (every GET route with the
  filters the screens send, then the writes: staff, masters, catalogue,
  patients, lab workflow, billing, payments, the gateway, refunds, payouts,
  reports) against the old Mongo backend (a checkout of `main`) and the new
  one, each starting from the same snapshot, and diffs every response.
  PDFs are compared by content and DOCX files by their entries.

  ```
  npx ts-node --transpile-only migration/mongo-copy.ts lms_db lms_snapshot
  npx ts-node --transpile-only migration/parity/run.ts --backend mongo --app <main checkout>/backend --out mongo.json
  npx ts-node --transpile-only migration/parity/run.ts --backend postgres --out pg.json
  npx ts-node --transpile-only migration/parity/compare.ts mongo.json pg.json
  ```

  Last run: 439 of 441 responses identical, the other 2 are the intended
  differences below.

`generate-rules.ts` wrote `src/db/rules.generated.ts` from the Mongoose schemas
and `legacy-models/` keeps those schemas for the checks above. They are only
needed while Mongo is still around to compare with.

## Differences, on purpose

Invalid input Mongo stored and Postgres refuses (both now a `400`):

- A reference to a record that does not exist - e.g. a doctor under a
  department id that is not there. Mongo saved the dangling id; the foreign key
  refuses it: `No department exists with id "…"`.
- A value outside a field's list sent through an update route (Mongoose ran no
  validators on `findByIdAndUpdate`) - e.g. a department status of `Dormant`.
  The `CHECK` constraint refuses it with the message Mongoose gave the same
  value on create.

Values that differ but mean the same:

- Older documents were saved without fields added later (`processingMode`,
  `packageName`, `cancellationReason`, …). Routes that read raw documents
  (`.lean()`, aggregations) left those out of the JSON; the column now holds
  the schema default, so it is sent.
- Mongoose's internal `__v` is no longer in the JSON. The frontend never read it.
- Opening a result sheet for a sample that had none stored
  `enteredBy.userId` as the whole patient document turned into text (a bug);
  it now stores the patient's id. Sheets already stored keep what they have.

## Things found on the way, left as they were

Behaviour the migration kept exactly, but worth knowing about:

- `/api/rate-history` is never mounted in `routes/index.ts` (404), and
  `PUT /api/tests/:id/rates`, which the frontend's rate editor calls, has no
  route (404).
- `POST /api/auth/refresh-token` with a malformed token answers `500`, not `401`.
- The appointment counter in a fresh install can hand out a number that is
  already taken if appointments were seeded without it (`409` on booking).
- `backend/.env` - with the JWT secrets - and both `node_modules` folders are
  committed to git.
