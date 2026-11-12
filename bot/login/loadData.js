'use strict';

const path = require('path');

async function loadData() {
	const config = global.Anchestor.config || {};
	const dbCfg = config.database || {};
	const dbType = (dbCfg.type || 'json').toLowerCase();

	if (dbType === 'sqlite') {
		await require('../../database/connectDB/connectSqlite')(); // stub, throws
	}
	if (dbType !== 'json' && dbType !== 'mongodb') {
		throw new Error(`unknown database.type "${dbType}" in config.json, expected "json" or "mongodb"`);
	}

	if (dbType === 'mongodb') {
		// env wins over config, same as everywhere else in this bot
		const uri = process.env.MONGODB_URI || dbCfg.uriMongodb || '';
		const dbName = process.env.MONGODB_DB || dbCfg.dbName || undefined;
		const connectMongoDB = require('../../database/connectDB/connectMongoDB');
		// throws on bad uri / unreachable / auth fail — boot stops here on
		// purpose, a bot with no database is worse than a bot that won't start
		const mongo = await connectMongoDB({ uri, dbName });
		const { ensureIndexes } = require('../../database/models/mongodb');
		await ensureIndexes(mongo.db);
		global.db.mongo = mongo;
		global.db.backend = { kind: 'mongodb', db: mongo.db, collections: mongo.collections };
		if (dbCfg.autoSyncWhenStart) {
			global.utils.log.info('DATABASE', 'autoSyncWhenStart is on — indexes ensured, thread info refreshes lazily on first message');
		}
	}

	if (dbType === 'json') {
		global.db.backend = { kind: 'json' };
	}

	const threadsData = require('../../database/controller/threadsData');
	const usersData = require('../../database/controller/usersData');
	const globalData = require('../../database/controller/globalData');

	global.db.threadsData = threadsData;
	global.db.usersData = usersData;
	global.db.globalData = globalData;

	global.db.allThreadData = await threadsData.getAll();
	global.db.allUserData = await usersData.getAll();
	// warm the global store so peek()/allGlobalData work sync later
	globalData.peek('__warmup__');

	if (dbType === 'mongodb') {
		global.utils.log.success('DATABASE', `mongodb database ready (${global.db.allThreadData.length} threads, ${global.db.allUserData.length} users, db ${global.db.mongo.dbName})`);
	}
	else {
		global.utils.log.success('DATABASE', `json database ready (${global.db.allThreadData.length} threads, ${global.db.allUserData.length} users)`);
	}
	return { threadsData, usersData, globalData };
}

module.exports = loadData;
module.exports.path = path;
