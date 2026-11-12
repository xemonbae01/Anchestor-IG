'use strict';

const thread = require('./thread');
const user = require('./user');
const globalModel = require('./global');

const models = { thread, user, global: globalModel };

// createIndex is idempotent — safe to run on every boot
async function ensureIndexes(db) {
	for (const model of Object.values(models)) {
		const coll = db.collection(model.collection);
		for (const idx of model.indexes || [])
			await coll.createIndex(idx.keys, idx.options || {});
	}
}

module.exports = { thread, user, global: globalModel, models, ensureIndexes };
