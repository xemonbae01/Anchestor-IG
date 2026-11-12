'use strict';

const path = require('path');
const { createStore } = require('../store');
const { getPath, setPath } = require('../connectDB/connectJson');

const filePath = path.join(__dirname, '..', 'data', 'global.json');
let store = null;

function buildStore() {
	const backend = (global.db && global.db.backend) || { kind: 'json' };
	if (backend.kind === 'mongodb') {
		// global docs are { _id: "<key>", value: <any> }
		return createStore('mongodb', {
			collection: backend.collections.global,
			keyField: '_id',
			encode: (key, value) => ({ _id: key, value }),
			decode: (doc) => ({ key: String(doc._id), value: doc.value })
		});
	}
	return createStore('json', {
		filePath,
		normalize: (raw) => raw || {}
	});
}

async function ensureStore() {
	if (!store) {
		store = buildStore();
		await store.load();
		refreshCache();
	}
	return store;
}

function refreshCache() {
	// allGlobalData is a plain object map, same as before
	if (global.db) global.db.allGlobalData = store ? Object.fromEntries(store.entries()) : {};
}

const globalData = {
	_filePath: filePath,

	// globalData.get("adminBot") / get("settings", "a.b", defaultValue)
	async get(key, pathStr, defaultValue) {
		await ensureStore();
		const val = store.get(key);
		if (val === undefined) return defaultValue;
		if (pathStr) {
			const out = getPath(val, pathStr);
			return out === undefined ? defaultValue : out;
		}
		return val;
	},

	// globalData.set("adminBot", [...]) / set("settings", value, "a.b")
	async set(key, value, pathStr) {
		await ensureStore();
		if (pathStr) {
			let cur = store.get(key);
			if (cur === null || typeof cur !== 'object') cur = {};
			setPath(cur, pathStr, value);
			store.set(key, cur);
			refreshCache();
			return cur;
		}
		store.set(key, value);
		refreshCache();
		return value;
	},

	async create(key, value) {
		await ensureStore();
		if (store.get(key) === undefined) store.set(key, value);
		refreshCache();
		return store.get(key);
	},

	peek(key) {
		if (!store) {
			store = buildStore();
			store.load().catch(() => {});
		}
		return store.get(key);
	},

	async _flush() {
		await ensureStore();
		return store.flush();
	},

	_reset() { // tests only
		store = null;
	}
};

module.exports = globalData;
