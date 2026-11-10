'use strict';

const path = require('path');
const { readStore, saveStore, getPath, setPath } = require('../connectDB/connectJson');

const filePath = path.join(__dirname, '..', 'data', 'users.json');
let store = null;

function ensureStore() {
	if (!store) {
		store = readStore(filePath, {});
		if (Array.isArray(store)) {
			const obj = {};
			for (const u of store) if (u && u.userID) obj[String(u.userID)] = u;
			store = obj;
		}
		if (global.db) global.db.allUserData = Object.values(store);
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
	if (global.db) global.db.allUserData = Object.values(store);
}

const usersData = {
	_filePath: filePath,

	async get(userID, pathStr) {
		ensureStore();
		const id = String(userID);
		if (!store[id]) {
			store[id] = defaultRecord(id);
			refreshCache();
			saveStore(filePath, store);
		}
		if (pathStr) return getPath(store[id], pathStr);
		return store[id];
	},

	async set(userID, value, pathStr) {
		ensureStore();
		const id = String(userID);
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

	async create(userID, data = {}) {
		ensureStore();
		const id = String(userID);
		if (!store[id]) store[id] = { ...defaultRecord(id), ...data };
		refreshCache();
		saveStore(filePath, store);
		return store[id];
	},

	peek(userID) {
		ensureStore();
		return store[String(userID)] || null;
	},

	_flush() {
		const { writeStoreNow } = require('../connectDB/connectJson');
		ensureStore();
		writeStoreNow(filePath, store);
	}
};

module.exports = usersData;
