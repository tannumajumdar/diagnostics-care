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
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from '../models/user.model';

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

const run = async () => {
  const dryRun = process.argv.includes('--dry-run');
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lms_db');

  for (const [from, to] of Object.entries(RENAMED)) {
    if (!(await User.exists({ email: from })) || (await User.exists({ email: to }))) continue;
    if (!dryRun) await User.updateOne({ email: from }, { $set: { email: to } });
    console.log(`${dryRun ? '[dry-run] ' : ''}~ ${from} -> ${to}`);
  }

  let added = 0;
  for (const s of STAFF) {
    if (await User.exists({ email: s.email })) continue;
    // Created one at a time so the model's password hashing hook runs.
    if (!dryRun) await User.create({ ...s, status: 'Active' });
    added++;
    console.log(`${dryRun ? '[dry-run] ' : ''}+ ${s.name} (${s.role}) - ${s.email}`);
  }

  console.log(`\n${dryRun ? 'Would add' : 'Added'}: ${added}, already present: ${STAFF.length - added}`);
  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error('Seeding staff failed:', err);
  await mongoose.disconnect();
  process.exit(1);
});
