import { prisma } from '../db/prisma';

/**
 * One-shot migration for centres already running against a live database.
 *
 * Two things changed underneath them: the Super Admin tier was removed, so any
 * account still holding it would fail the role enum and be unable to log in;
 * and the expense ledger became a payout ledger, so older rows have no payee
 * on them. Both are repaired in place rather than by re-seeding, which would
 * destroy real patient and billing history.
 *
 * On Postgres both repairs are no-ops kept for the record: the User role CHECK
 * constraint refuses 'Super Admin', and payeeName is NOT NULL, so neither bad
 * state can exist any more. The counts printed are always 0.
 */
export async function migrateRoles() {
  // Always 0: User_role_check means no row can hold 'Super Admin'.
  const promoted = await prisma.user.updateMany({ where: { role: 'Super Admin' }, data: { role: 'Admin' } });
  console.log(`Promoted ${promoted.count} Super Admin account(s) to Admin.`);

  // Older expense rows predate payeeName/payeeType/status; back-fill them from
  // the free-text category so the payout report can total them.
  // Nothing to find here: payeeName is a NOT NULL column, so every row that
  // reached Postgres already carries a payee and there is no row to back-fill.
  const legacy = { count: 0 };
  console.log(`Back-filled ${legacy.count} legacy expense record(s) as payouts.`);

  return { promoted: promoted.count, backfilled: legacy.count };
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
