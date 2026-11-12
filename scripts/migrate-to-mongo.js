'use strict';

// one-way json -> mongodb import. idempotent — everything is an upsert, so
// running it twice just rewrites the same documents. usage:
//   node scripts/migrate-to-mongo.js [--dry-run] [--force]
//   node scripts/migrate-to-mongo.js --uri "mongodb+srv://..." --db anchestor
// needs a uri from --uri, MONGODB_URI or config.json database.uriMongodb.

const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const models = require('../database/models/mongodb');

function readJsonFile(filePath) {
	if (!fs.existsSync(filePath)) return {};
	return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function toRecords(raw, keyField) {
	if (Array.isArray(raw)) return raw.filter((r) => r && r[keyField]);
	if (raw && typeof raw === 'object') return Object.values(raw);
	return [];
}

// strip a stray _id from a record (json files shouldn't have one, but if a
// doc was dumped back into json it might) so the upsert doesn't fight mongo
function cleanRecord(rec) {
	const out = { ...rec };
	delete out._id;
	return out;
}

async function importCollection(db, model, records, dryRun) {
	const coll = db.collection(model.collection);
	const counts = { inserted: 0, updated: 0, skipped: 0 };
	const ops = [];
	for (const rec of records) {
		const key = rec[model.keyField];
		if (key === undefined || key === null || key === '') { counts.skipped++; continue; }
		ops.push({
			updateOne: {
				filter: { [model.keyField]: key },
				update: { $set: cleanRecord(rec) },
				upsert: true
			}
		});
	}
	if (dryRun || !ops.length) return counts;
	const res = await coll.bulkWrite(ops, { ordered: false });
	counts.inserted = res.upsertedCount || 0;
	counts.updated = res.matchedCount || 0;
	return counts;
}

async function importGlobal(db, obj, dryRun) {
	const coll = db.collection('global');
	const counts = { inserted: 0, updated: 0, skipped: 0 };
	const ops = [];
	for (const [key, value] of Object.entries(obj || {})) {
		if (!key) { counts.skipped++; continue; }
		ops.push({
			updateOne: {
				filter: { _id: key },
				update: { $set: { value } },
				upsert: true
			}
		});
	}
	if (dryRun || !ops.length) return counts;
	const res = await coll.bulkWrite(ops, { ordered: false });
	counts.inserted = res.upsertedCount || 0;
	counts.updated = res.matchedCount || 0;
	return counts;
}

// the real import, exported so tests can drive it against a fake db
async function importJsonToMongo({ db, dataDir, dryRun = false }) {
	const threadsRaw = readJsonFile(path.join(dataDir, 'threads.json'));
	const usersRaw = readJsonFile(path.join(dataDir, 'users.json'));
	const globalRaw = readJsonFile(path.join(dataDir, 'global.json'));
	const threads = toRecords(threadsRaw, 'threadID');
	const users = toRecords(usersRaw, 'userID');
	const result = {
		threads: await importCollection(db, models.thread, threads, dryRun),
		users: await importCollection(db, models.user, users, dryRun),
		global: await importGlobal(db, globalRaw, dryRun),
		// first record of each collection, for the verify step
		_samples: { thread: threads[0] || null, user: users[0] || null, globalKey: Object.keys(globalRaw || {})[0] || null }
	};
	return result;
}

function parseArgs(argv) {
	const args = { dryRun: false, force: false, uri: null, db: null, dataDir: null };
	for (let i = 0; i < argv.length; i++) {
		if (argv[i] === '--dry-run') args.dryRun = true;
		else if (argv[i] === '--force') args.force = true;
		else if (argv[i] === '--uri') args.uri = argv[++i];
		else if (argv[i] === '--db') args.db = argv[++i];
		else if (argv[i] === '--data-dir') args.dataDir = argv[++i];
	}
	return args;
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const dataDir = args.dataDir || path.join(rootDir, 'database', 'data');
	const config = readJsonFile(path.join(rootDir, 'config.json'));
	const uri = args.uri || process.env.MONGODB_URI || (config.database && config.database.uriMongodb) || '';
	const dbName = args.db || process.env.MONGODB_DB || (config.database && config.database.dbName) || undefined;

	const counts = {
		threads: Object.keys(readJsonFile(path.join(dataDir, 'threads.json'))).length,
		users: Object.keys(readJsonFile(path.join(dataDir, 'users.json'))).length,
		global: Object.keys(readJsonFile(path.join(dataDir, 'global.json'))).length
	};
	const total = counts.threads + counts.users + counts.global;
	if (args.dryRun) {
		console.log('[migrate] dry run — nothing written');
		console.log(`[migrate] would import ${counts.threads} threads, ${counts.users} users, ${counts.global} global keys (${total} records)`);
		return;
	}

	if (!uri) {
		console.error('[migrate] no mongodb uri — pass --uri, set MONGODB_URI, or fill database.uriMongodb in config.json');
		process.exit(1);
	}

	const connectMongoDB = require('../database/connectDB/connectMongoDB');
	const mongo = await connectMongoDB({ uri, dbName });
	const { ensureIndexes } = require('../database/models/mongodb');
	await ensureIndexes(mongo.db);
	try {
		// already on mongo with data in it? probably a re-run by mistake —
		// upserts would make it harmless, but ask for --force anyway
		if (!args.force && config.database && config.database.type === 'mongodb') {
			let existing = 0;
			for (const name of ['threads', 'users', 'global'])
				existing += await mongo.db.collection(name).countDocuments();
			if (existing > 0) {
				console.error(`[migrate] database.type is already "mongodb" and the database has ${existing} documents — refusing to re-import, pass --force if you really mean it`);
				process.exit(1);
			}
		}

		const result = await importJsonToMongo({ db: mongo.db, dataDir });
		for (const name of ['threads', 'users', 'global']) {
			const c = result[name];
			console.log(`[migrate] ${name}: ${c.inserted} inserted, ${c.updated} updated, ${c.skipped} skipped`);
		}

		// verify: counts match the source files, and a sample record reads back
		for (const [name, file] of [['threads', 'threads.json'], ['users', 'users.json'], ['global', 'global.json']]) {
			const expected = Object.keys(readJsonFile(path.join(dataDir, file))).length;
			const actual = await mongo.db.collection(name).countDocuments();
			if (actual < expected) {
				console.error(`[migrate] verify failed for ${name}: expected at least ${expected} documents, found ${actual}`);
				process.exit(1);
			}
		}
		if (result._samples.thread) {
			const back = await mongo.db.collection('threads').findOne({ threadID: result._samples.thread.threadID });
			if (!back || back.threadID !== result._samples.thread.threadID) {
				console.error('[migrate] verify failed: sample thread did not read back');
				process.exit(1);
			}
		}
		console.log(`[migrate] done — ${total} records imported into db "${mongo.dbName}". set database.type to "mongodb" in config.json to use it.`);
	}
	finally {
		await mongo.close();
	}
}

if (require.main === module) {
	main().catch((err) => {
		console.error(`[migrate] ${err.message}`);
		process.exit(1);
	});
}

module.exports = { importJsonToMongo, parseArgs };
