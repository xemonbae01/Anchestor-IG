'use strict';

const path = require('path');

async function loadData() {
	const config = global.Anchestor.config || {};
	const dbType = ((config.database || {}).type || 'json').toLowerCase();
	if (dbType !== 'json') {
		// stubs throw a clear error on purpose, see database/connectDB
		if (dbType === 'mongodb') await require('../../database/connectDB/connectMongoDB')();
		else if (dbType === 'sqlite') await require('../../database/connectDB/connectSqlite')();
		else throw new Error(`unknown database.type "${dbType}" in config.json, only "json" works in this build`);
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

	global.utils.log.success('DATABASE', `json database ready (${global.db.allThreadData.length} threads, ${global.db.allUserData.length} users)`);
	return { threadsData, usersData, globalData };
}

module.exports = loadData;
module.exports.path = path;
