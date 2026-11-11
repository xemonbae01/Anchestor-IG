'use strict';

const path = require('path');
const { readStore, saveStore, getPath, setPath } = require('../connectDB/connectJson');

const filePath = path.join(__dirname, '..', 'data', 'global.json');
let store = null;

function ensureStore() {
	if (!store) {
		store = readStore(filePath, {});
		if (global.db) global.db.allGlobalData = store;
	}
	return store;
}

const globalData = {
	_filePath: filePath,

	// globalData.get("adminBot") / get("settings", "a.b", defaultValue)
	async get(key, pathStr, defaultValue) {
		ensureStore();
		if (!(key in store)) return defaultValue;
		if (pathStr) {
			const val = getPath(store[key], pathStr);
			return val === undefined ? defaultValue : val;
		}
		return store[key];
	},

	// globalData.set("adminBot", [...]) / set("settings", value, "a.b")
	async set(key, value, pathStr) {
		ensureStore();
		if (pathStr) {
			if (store[key] === null || typeof store[key] !== 'object') store[key] = {};
			setPath(store[key], pathStr, value);
		}
		else store[key] = value;
		if (global.db) global.db.allGlobalData = store;
		saveStore(filePath, store);
		return store[key];
	},

	async create(key, value) {
		ensureStore();
		if (!(key in store)) store[key] = value;
		saveStore(filePath, store);
		return store[key];
	},

	peek(key) {
		ensureStore();
		return store[key];
	},

	_flush() {
		const { flushStore } = require('../connectDB/connectJson');
		ensureStore();
		return flushStore(filePath, store);
	}
};

module.exports = globalData;
