/**
 * Puts the front-desk team on the user list.
 *
 * The desk runs in shifts, so the cash taken at the counter is split across
 * two or three receptionists a day. The payment ledger filters by the person
 * who took each payment; it needs those people to exist as users before a
 * shift's collection can be pulled out on its own.
 *
 * Additive and safe to re-run. A user whose email is already registered is
 * left exactly as it is; nothing is ever deleted.
 *
 *   npm run seed:staff              # add whoever is missing
 *   npm run seed:staff -- --dry-run # show who would be added
 */
import dotenv from 'dotenv';
import { prisma } from '../db/prisma';
import { repo } from '../db/repo';
import { hashIfSet } from '../db/passwords';

dotenv.config();

const STAFF = [
  { name: 'Centre Admin', email: 'admin@lms.com', password: 'Admin@123456', role: 'Admin', mobile: '9876543211' },
  { name: 'Emily Davis', email: 'receptionist@lms.com', password: 'User@123456', role: 'Receptionist', mobile: '9876543214' },
  { name: 'Neha Sharma', email: 'neha@lms.com', password: 'User@123456', role: 'Receptionist', mobile: '9876543215' },
  { name: 'Rohit Verma', email: 'rohit@lms.com', password: 'User@123456', role: 'Receptionist', mobile: '9876543216' },
];

// Addresses the shift receptionists were first created under. A database
// seeded then is moved onto the new address rather than given a second user.
const RENAMED: Record<string, string> = {
  'reception.morning@lms.com': 'neha@lms.com',
  'reception.evening@lms.com': 'rohit@lms.com',
};

/** Whether a user is already registered under this email. */
const userExists = async (email: string) =>
  !!(await prisma.user.findFirst({ where: { email }, select: { id: true } }));

const run = async () => {
  const dryRun = process.argv.includes('--dry-run');

  for (const [from, to] of Object.entries(RENAMED)) {
    if (!(await userExists(from)) || (await userExists(to))) continue;
    if (!dryRun) await prisma.user.update({ where: { email: from }, data: { email: to } });
    console.log(`${dryRun ? '[dry-run] ' : ''}~ ${from} -> ${to}`);
  }

  let added = 0;
  for (const s of STAFF) {
    if (await userExists(s.email)) continue;
    // Created one at a time, each with its password hashed on the way in.
    if (!dryRun) await repo.create('user', { ...s, status: 'Active' }, { transform: hashIfSet(s.password) });
    added++;
    console.log(`${dryRun ? '[dry-run] ' : ''}+ ${s.name} (${s.role}) - ${s.email}`);
  }

  console.log(`\n${dryRun ? 'Would add' : 'Added'}: ${added}, already present: ${STAFF.length - added}`);
  await prisma.$disconnect();
};

run().catch(async (err) => {
  console.error('Seeding staff failed:', err);
  await prisma.$disconnect();
  process.exit(1);
});
