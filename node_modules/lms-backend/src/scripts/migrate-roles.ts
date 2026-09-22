import mongoose from 'mongoose';
import { User } from '../models/user.model';
import { Payout } from '../models/expense.model';

/**
 * One-shot migration for centres already running against a live database.
 *
 * Two things changed underneath them: the Super Admin tier was removed, so any
 * account still holding it would fail the role enum and be unable to log in;
 * and the expense ledger became a payout ledger, so older rows have no payee
 * on them. Both are repaired in place rather than by re-seeding, which would
 * destroy real patient and billing history.
 */
export async function migrateRoles() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lms_db';
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(mongoUri);
  }

  const promoted = await User.updateMany({ role: 'Super Admin' }, { $set: { role: 'Admin' } });
  console.log(`Promoted ${promoted.modifiedCount} Super Admin account(s) to Admin.`);

  // Older expense rows predate payeeName/payeeType/status; back-fill them from
  // the free-text category so the payout report can total them.
  const legacy = await Payout.collection.updateMany(
    { payeeName: { $exists: false } },
    [
      {
        $set: {
          payeeName: { $ifNull: ['$category', 'Unrecorded payee'] },
          payeeType: 'Other',
          status: 'Paid',
          needsApproval: false,
        },
      },
    ] as any
  );
  console.log(`Back-filled ${legacy.modifiedCount} legacy expense record(s) as payouts.`);

  return { promoted: promoted.modifiedCount, backfilled: legacy.modifiedCount };
}

export default migrateRoles;

if (require.main === module) {
  migrateRoles()
    .then(() => {
      console.log('Migration complete.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}
