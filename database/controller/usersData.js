'use strict';

const path = require('path');
const { createStore } = require('../store');
const { getPath, setPath } = require('../connectDB/connectJson');

const filePath = path.join(__dirname, '..', 'data', 'users.json');
let store = null;

function buildStore() {
	const backend = (global.db && global.db.backend) || { kind: 'json' };
	if (backend.kind === 'mongodb') {
		return createStore('mongodb', {
			collection: backend.collections.users,
			keyField: 'userID'
		});
	}
	return createStore('json', {
		filePath,
		normalize(raw) {
			if (Array.isArray(raw)) {
				const obj = {};
				for (const u of raw) if (u && u.userID) obj[String(u.userID)] = u;
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

function defaultRecord(userID) {
	return {
		userID: String(userID),
		name: null,
		username: null,
		data: {},
		banned: { status: false, reason: null, date: null },
		exp: 0,
		messageCount: 0,
		createdAt: Date.now()
	};
}

function refreshCache() {
	if (global.db) global.db.allUserData = store ? store.getAll() : [];
}

const usersData = {
	_filePath: filePath,

	async get(userID, pathStr) {
		await ensureStore();
		const id = String(userID);
		let rec = store.get(id);
		if (!rec) {
			rec = defaultRecord(id);
			store.set(id, rec);
			refreshCache();
		}
		if (pathStr) return getPath(rec, pathStr);
		return rec;
	},

	async set(userID, value, pathStr) {
		await ensureStore();
		const id = String(userID);
		let rec = store.get(id);
		if (!rec) rec = defaultRecord(id);
		if (pathStr) setPath(rec, pathStr, value);
		else if (value && typeof value === 'object') Object.assign(rec, value);
		store.set(id, rec);
		refreshCache();
		return rec;
	},

	async getAll() {
		await ensureStore();
		return store.getAll();
	},

	async create(userID, data = {}) {
		await ensureStore();
		const id = String(userID);
		let rec = store.get(id);
		if (!rec) {
			rec = { ...defaultRecord(id), ...data };
			store.set(id, rec);
		}
		refreshCache();
		return rec;
	},

	peek(userID) {
		if (!store) {
			store = buildStore();
			store.load().catch(() => {});
		}
		return store.get(String(userID)) || null;
	},

	async _flush() {
		await ensureStore();
		return store.flush();
	},

	_reset() { // tests only
		store = null;
	}
};

module.exports = usersData;
