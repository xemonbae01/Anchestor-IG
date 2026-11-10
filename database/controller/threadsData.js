'use strict';

const path = require('path');
const { readStore, saveStore, getPath, setPath } = require('../connectDB/connectJson');

const filePath = path.join(__dirname, '..', 'data', 'threads.json');
let store = null; // { [threadID]: record }

function ensureStore() {
	if (!store) {
		store = readStore(filePath, {});
		if (Array.isArray(store)) { // old array format, normalize
			const obj = {};
			for (const t of store) if (t && t.threadID) obj[String(t.threadID)] = t;
			store = obj;
		}
		if (global.db) global.db.allThreadData = Object.values(store);
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
	if (global.db) global.db.allThreadData = Object.values(store);
}

const threadsData = {
	_filePath: filePath,

	async get(threadID, pathStr) {
		ensureStore();
		const id = String(threadID);
		if (!store[id]) {
			store[id] = defaultRecord(id);
			refreshCache();
			saveStore(filePath, store);
		}
		if (pathStr) return getPath(store[id], pathStr);
		return store[id];
	},

	async set(threadID, value, pathStr) {
		ensureStore();
		const id = String(threadID);
		if (!store[id]) store[id] = defaultRecord(id);
		if (pathStr) setPath(store[id], pathStr, value);
		else if (value && typeof value === 'object') Object.assign(store[id], value);
		refreshCache();
		saveStore(filePath, store);
		return store[id];
	},

	async getAll() {
		ensureStore();
		return Object.values(store);
	},

	async create(threadID, data = {}) {
		ensureStore();
		const id = String(threadID);
		if (!store[id]) store[id] = { ...defaultRecord(id), ...data };
		refreshCache();
		saveStore(filePath, store);
		return store[id];
	},

	// internal: instant access for utils.getPrefix, no create
	peek(threadID) {
		ensureStore();
		return store[String(threadID)] || null;
	},

	_flush() { // used by tests/shutdown
		const { writeStoreNow } = require('../connectDB/connectJson');
		ensureStore();
		writeStoreNow(filePath, store);
	}
};

module.exports = threadsData;
