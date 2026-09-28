/**
 * Records every response of the parity scenario against one backend.
 *
 *   npx ts-node --transpile-only migration/parity/run.ts --backend mongo    --app <backendDir> --out a.json
 *   npx ts-node --transpile-only migration/parity/run.ts --backend postgres --app <backendDir> --out b.json
 *
 * Before the run the database is reset to the frozen snapshot (`lms_snapshot`
 * in Mongo): for mongo it is copied to `lms_parity`; for postgres a new,
 * empty database is created, migrated and loaded from that same snapshot. The
 * live `lms_db` is never touched.
 *
 * `--app` is the backend directory to start. Point the mongo run at a
 * checkout of `main` (the code as it was) and the postgres run at this branch.
 */
import { spawn, execSync, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import zlib from 'zlib';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import PizZip from 'pizzip';
import { SCENARIO, pickIds, pickValues, Ctx } from './scenario';

const arg = (name: string, fallback?: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};

const backend = arg('backend') as 'mongo' | 'postgres';
const appDir = path.resolve(arg('app', path.join(__dirname, '../..'))!);
const out = path.resolve(arg('out', `parity-${backend}.json`)!);
const only = arg('only');
const PORT = Number(arg('port', '5055'));
/** Where to write the raw bytes of file responses (PDF, DOCX), for inspecting a mismatch. */
const dump = arg('dump');
const here = path.join(__dirname, '../..');

const env = dotenv.parse(fs.readFileSync(path.join(here, '.env')));
const MONGO_HOST = 'mongodb://127.0.0.1:27017';

function prepareDatabase(): Record<string, string> {
  const run = (cmd: string, extra: Record<string, string> = {}) =>
    execSync(cmd, { cwd: here, stdio: 'pipe', env: { ...process.env, ...extra } }).toString();

  if (backend === 'mongo') {
    run('npx ts-node --transpile-only migration/mongo-copy.ts lms_snapshot lms_parity');
    return { MONGODB_URI: `${MONGO_HOST}/lms_parity` };
  }

  // The Prisma engine occasionally dies on exit on Windows (0xC0000409)
  // before the load finishes; a fresh database and another go clears it.
  for (let attempt = 1; ; attempt++) {
    try {
      return loadPostgres(run);
    } catch (error) {
      if (attempt >= 3) throw error;
      console.log(`postgres load failed, retrying (${attempt})`);
    }
  }
}

function loadPostgres(run: (cmd: string, extra?: Record<string, string>) => string): Record<string, string> {
  const name = `lms_parity_${Date.now()}`;
  const base = env.DATABASE_URL;
  const admin = base.replace(/\/[^/?]+\?/, '/postgres?');
  const url = base.replace(/\/[^/?]+\?/, `/${name}?`);
  run(
    `node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient({datasources:{db:{url:process.env.ADMIN_URL}}});p.$executeRawUnsafe(process.env.SQL).finally(()=>p.$disconnect())"`,
    { ADMIN_URL: admin, SQL: `CREATE DATABASE "${name}" ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0` }
  );
  run('npx prisma migrate deploy', { DATABASE_URL: url });
  run('npx ts-node --transpile-only migration/mongo-to-postgres.ts lms_snapshot', { DATABASE_URL: url });
  // Modules not moved yet still read Mongo, from a copy of the same snapshot.
  run('npx ts-node --transpile-only migration/mongo-copy.ts lms_snapshot lms_parity');
  return { DATABASE_URL: url, MONGODB_URI: `${MONGO_HOST}/lms_parity` };
}

async function startApp(dbEnv: Record<string, string>): Promise<ChildProcess> {
  const child = spawn('npx', ['ts-node', '--transpile-only', 'src/app.ts'], {
    cwd: appDir,
    env: { ...process.env, ...dbEnv, PORT: String(PORT), NODE_ENV: 'development' },
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  child.stdout!.on('data', (d) => (log += d));
  child.stderr!.on('data', (d) => (log += d));

  for (let i = 0; i < 120; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/health`);
      if (res.ok) return child;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  child.kill();
  throw new Error(`Backend did not start:\n${log}`);
}

function stopApp(child: ChildProcess) {
  if (process.platform === 'win32') {
    try {
      execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: 'ignore' });
    } catch {
      /* already gone */
    }
  } else child.kill('SIGTERM');
}

/**
 * PDFs stamp their creation time and a random id; strip both before hashing.
 * A DOCX is a zip whose entries carry the time they were written, so it is
 * hashed by what is inside the entries rather than by its bytes.
 */
function fingerprint(buf: Buffer, type: string) {
  if (type.includes('wordprocessingml')) {
    const zip = new PizZip(buf);
    const hash = crypto.createHash('sha1');
    for (const name of Object.keys(zip.files).sort()) {
      hash.update(name).update(zip.files[name].asUint8Array());
    }
    return { binary: true, contentType: type, entries: Object.keys(zip.files).length, sha: hash.digest('hex') };
  }
  let text = buf.toString('latin1');
  if (type.includes('pdf')) {
    // A report prints when it was verified and reported - today, at whatever
    // minute the run reached that step. The text runs are hex strings inside
    // the (deflated) page streams, so those are opened, and a time printed
    // beside today's date is blanked; everything else is still compared.
    const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const stamp = new RegExp(`(${today.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}, )\\d{1,2}:\\d{2} [ap]m`, 'g');
    text = text.replace(/stream\r?\n([\s\S]*?)endstream/g, (whole, body) => {
      let inflated: string;
      try {
        inflated = zlib.inflateSync(Buffer.from(body, 'latin1')).toString('latin1');
      } catch {
        return whole;
      }
      const masked = inflated.replace(/<([0-9a-f]+)>/gi, (hex, digits) => {
        const decoded = Buffer.from(digits, 'hex').toString('latin1');
        return decoded.search(stamp) >= 0 ? `<${Buffer.from(decoded.replace(stamp, '$1--:--'), 'latin1').toString('hex')}>` : hex;
      });
      return `stream\n${masked}endstream`;
    });
    // A re-compressed stream is a different length, which moves every byte
    // offset after it: the /Length entries and the xref table are left out.
    text = text.replace(/\/Length \d+/g, '/Length').replace(/\nxref\n[\s\S]*$/, '\nxref');
    text = text
      .replace(/\(D:\d{14}Z\)/g, '')
      .replace(/\/ID \[<[0-9a-f]+> <[0-9a-f]+>\]/gi, '');
  }
  return {
    binary: true,
    contentType: type,
    bytes: buf.length,
    sha: crypto.createHash('sha1').update(text, 'latin1').digest('hex'),
  };
}

(async () => {
  if (backend !== 'mongo' && backend !== 'postgres') throw new Error('--backend mongo|postgres');

  const dbEnv = prepareDatabase();
  const conn = await mongoose.createConnection(`${MONGO_HOST}/lms_snapshot`).asPromise();
  const ids = await pickIds(conn.db!);
  const values = await pickValues(conn.db!);
  const users = await conn.db!.collection('users').find().toArray();
  await conn.close();

  const secret = env.JWT_SECRET || 'lms_jwt_secret_key_development_2026';
  const token = (userId: string) => {
    const u = users.find((x) => String(x._id) === userId);
    return u ? jwt.sign({ userId, email: u.email, role: u.role, name: u.name }, secret, { expiresIn: '8h' }) : '';
  };
  const tokens: Record<string, string> = {
    admin: token(ids.admin),
    receptionist: token(ids.receptionist),
    pathologist: token(ids.pathologist),
    none: '',
  };

  const startedAt = new Date().toISOString();
  let app = await startApp(dbEnv);
  const ctx: Ctx = { ids, values };
  const records: any[] = [];
  // The API allows 300 requests per 15 minutes per address, counted in
  // memory. A restart every so often keeps a long run under it without
  // touching the app.
  let sinceStart = 0;

  try {
    for (const step of SCENARIO) {
      if (only && !only.split(',').some((prefix) => step.name.startsWith(prefix))) continue;
      if (++sinceStart > 250) {
        stopApp(app);
        app = await startApp(dbEnv);
        sinceStart = 1;
      }
      const url = typeof step.path === 'function' ? step.path(ctx) : step.path;
      const body = typeof step.body === 'function' ? step.body(ctx) : step.body;
      const auth = step.token ? step.token(ctx) : tokens[step.as || 'admin'];

      const res = await fetch(`http://127.0.0.1:${PORT}/api${url}`, {
        method: step.method,
        headers: {
          ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });

      const type = res.headers.get('content-type') || '';
      let payload: any;
      if (type.includes('application/json')) {
        payload = await res.json();
        // Stack traces are development noise and differ by file layout.
        if (payload && typeof payload === 'object') delete payload.stack;
      } else if (type.startsWith('text/')) {
        // Express's own pages ("Cannot PUT /api/...") - kept as text, so the
        // ids inside them can be masked like any other.
        payload = { contentType: type, text: await res.text() };
      } else {
        const bytes = Buffer.from(await res.arrayBuffer());
        payload = fingerprint(bytes, type);
        if (dump) {
          fs.mkdirSync(dump, { recursive: true });
          fs.writeFileSync(path.join(dump, step.name), bytes);
        }
        payload.disposition = res.headers.get('content-disposition');
      }

      step.keep?.(payload, ctx);
      records.push({ name: step.name, method: step.method, url, status: res.status, unordered: step.unordered, known: step.known, body: payload });
      process.stdout.write(`${res.status} ${step.name}\n`);
    }
  } finally {
    stopApp(app);
  }

  fs.writeFileSync(out, JSON.stringify({ backend, startedAt, ids, records }, null, 2));
  console.log(`\n${records.length} responses -> ${out}`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
