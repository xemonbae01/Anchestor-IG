'use strict';

// raw mongodb driver, no mongoose. single client, small pool, fails fast
// (~5s) so a bad uri kills the boot with a clear message instead of hanging.
function maskUri(uri) {
	if (!uri) return '';
	// mongodb+srv://user:password@host/... -> user:***@host
	return String(uri).replace(/:\/\/([^:/@]+):[^@]*@/, '://$1:***@');
}

function dbFromUri(uri) {
	try {
		const name = new URL(uri).pathname.replace(/^\//, '').split('/')[0];
		return name || null;
	}
	catch { return null; }
}

async function connectMongoDB({ uri, dbName } = {}) {
	let MongoClient;
	try {
		({ MongoClient } = require('mongodb'));
	}
	catch {
		throw new Error('mongodb driver is not installed — run: npm install');
	}
	if (!uri) {
		throw new Error('no mongodb uri configured — set database.uriMongodb in config.json or the MONGODB_URI env var');
	}
	const name = dbName || dbFromUri(uri) || 'anchestor';
	const client = new MongoClient(uri, { maxPoolSize: 10, serverSelectionTimeoutMS: 5000 });
	try {
		await client.connect();
		await client.db(name).command({ ping: 1 });
	}
	catch (err) {
		try { await client.close(); } catch { /* already dead */ }
		throw new Error(`could not connect to mongodb (${maskUri(uri)}): ${err.message}`);
	}
	const db = client.db(name);
	return {
		client,
		db,
		dbName: name,
		collections: {
			threads: db.collection('threads'),
			users: db.collection('users'),
			global: db.collection('global')
		},
		close: () => client.close()
	};
}

module.exports = connectMongoDB;
module.exports.maskUri = maskUri;
module.exports.dbFromUri = dbFromUri;
