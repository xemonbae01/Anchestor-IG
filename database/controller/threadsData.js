'use strict';

const path = require('path');
const { createStore } = require('../store');
const { getPath, setPath } = require('../connectDB/connectJson');

const filePath = path.join(__dirname, '..', 'data', 'threads.json');
let store = null; // backend store, json or mongodb — same interface either way

function buildStore() {
	const backend = (global.db && global.db.backend) || { kind: 'json' };
	if (backend.kind === 'mongodb') {
		return createStore('mongodb', {
			collection: backend.collections.threads,
			keyField: 'threadID'
		});
	}
	return createStore('json', {
		filePath,
		normalize(raw) {
			if (Array.isArray(raw)) { // old array format, normalize
				const obj = {};
				for (const t of raw) if (t && t.threadID) obj[String(t.threadID)] = t;
				return obj;
			}
			return raw || {};
		}
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

function defaultRecord(threadID) {
	return {
		threadID: String(threadID),
		threadName: null,
		isGroup: false,
		participantIDs: [],
		adminIDs: [],
		memberCount: 0,
		messageCount: 0,
		data: {},
		banned: { status: false, reason: null, date: null },
		createdAt: Date.now()
	};
}

function refreshCache() {
	if (global.db) global.db.allThreadData = store ? store.getAll() : [];
}

const threadsData = {
	_filePath: filePath,

	async get(threadID, pathStr) {
		await ensureStore();
		const id = String(threadID);
		let rec = store.get(id);
		if (!rec) {
			rec = defaultRecord(id);
			store.set(id, rec);
			refreshCache();
		}
		if (pathStr) return getPath(rec, pathStr);
		return rec;
	},

	async set(threadID, value, pathStr) {
		await ensureStore();
		const id = String(threadID);
		let rec = store.get(id);
		if (!rec) rec = defaultRecord(id);
		if (pathStr) setPath(rec, pathStr, value);
		else if (value && typeof value === 'object') Object.assign(rec, value);
		store.set(id, rec); // re-set so mongo marks the key dirty
		refreshCache();
		return rec;
	},

	async getAll() {
		await ensureStore();
		return store.getAll();
	},

	async create(threadID, data = {}) {
		await ensureStore();
		const id = String(threadID);
		let rec = store.get(id);
		if (!rec) {
			rec = { ...defaultRecord(id), ...data };
			store.set(id, rec);
		}
		refreshCache();
		return rec;
	},

	// internal: instant access for utils.getPrefix, no create
	peek(threadID) {
		if (!store) {
			store = buildStore();
			store.load().catch(() => {});
		}
		return store.get(String(threadID)) || null;
	},

	async _flush() { // used by tests/shutdown
		await ensureStore();
		return store.flush();
	},

	_reset() { // tests only, drop the cached store so it rebuilds
		store = null;
	}
};

module.exports = threadsData;
