/**
 * Copies one Mongo database into another, collection by collection, replacing
 * whatever the target held.
 *
 *   npx ts-node --transpile-only migration/mongo-copy.ts <from> <to>
 *
 * The parity runs use it twice: once to freeze the live `lms_db` as
 * `lms_snapshot`, and before every recording to reset a scratch database back
 * to that snapshot - so the Mongo backend and the Postgres backend both start
 * from exactly the same data, and the live database is never written to.
 */
import mongoose from 'mongoose';

const [from, to] = process.argv.slice(2);
if (!from || !to || from === to) {
  console.error('usage: mongo-copy.ts <fromDb> <toDb>');
  process.exit(1);
}
if (to === 'lms_db') {
  console.error('Refusing to overwrite the live lms_db.');
  process.exit(1);
}

const host = process.env.MONGO_HOST || 'mongodb://127.0.0.1:27017';

(async () => {
  const conn = await mongoose.createConnection(`${host}/${from}`).asPromise();
  const source = conn.db!;
  const target = conn.useDb(to).db!;

  await target.dropDatabase();
  for (const { name } of await source.listCollections().toArray()) {
    const docs = await source.collection(name).find().toArray();
    await target.createCollection(name);
    if (docs.length) await target.collection(name).insertMany(docs);
    console.log(`${name}: ${docs.length}`);
  }
  await conn.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
