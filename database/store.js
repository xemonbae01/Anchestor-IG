'use strict';

// one store interface for both backends, so the controllers never care
// which one is behind them. everything is cached in memory and reads are
// sync after load(); writes mark keys dirty and flush debounced, flush()
// forces it right now. json writes the whole file, mongo upserts only the
// dirty keys — never a full collection rewrite.

const { readStore, saveStore, flushStore } = require('./connectDB/connectJson');

function jsonStore(opts) {
	const cache = new Map();
	let loaded = false;
	const filePath = opts.filePath;

	return {
		kind: 'json',
		async load() {
			if (loaded) return;
			loaded = true;
			const raw = readStore(filePath, {});
			const obj = opts.normalize ? opts.normalize(raw) : raw;
			for (const [k, v] of Object.entries(obj || {})) cache.set(String(k), v);
		},
		get(key) { return cache.get(String(key)); },
		set(key, value) {
			cache.set(String(key), value);
			saveStore(filePath, Object.fromEntries(cache));
		},
		delete(key) {
			cache.delete(String(key));
			saveStore(filePath, Object.fromEntries(cache));
		},
		getAll() { return [...cache.values()]; },
		entries() { return [...cache.entries()]; },
		async flush() { await flushStore(filePath, Object.fromEntries(cache)); },
		async close() { await this.flush(); }
	};
}

function mongoStore(opts) {
	const cache = new Map();
	const dirty = new Set();
	const deleted = new Set();
	const collection = opts.collection;
	const keyField = opts.keyField;
	let loaded = false;
	let loadPromise = null;
	let timer = null;
	let flushPromise = null;

	// doc shape in the collection, key is always inside the doc
	const encode = opts.encode || ((key, value) => {
		const doc = { ...value };
		delete doc._id;
		doc[keyField] = key;
		return doc;
	});
	const decode = opts.decode || ((doc) => {
		const value = { ...doc };
		delete value._id;
		return { key: String(doc[keyField]), value };
	});
	const filterFor = opts.filter || ((key) => ({ [keyField]: key }));

	function scheduleFlush() {
		if (timer) return;
		timer = setTimeout(() => { timer = null; doFlush().catch(() => {}); }, opts.debounceMs || 250);
		if (timer.unref) timer.unref();
	}

	async function doFlush() {
		if (flushPromise) return flushPromise;
		if (!dirty.size && !deleted.size) return;
		const ops = [];
		for (const key of dirty) {
			const value = cache.get(key);
			if (value === undefined) continue;
			ops.push({
				updateOne: {
					filter: filterFor(key),
					update: { $set: encode(key, value) },
					upsert: true
				}
			});
		}
		for (const key of deleted)
			ops.push({ deleteOne: { filter: filterFor(key) } });
		const flushedDirty = new Set(dirty);
		const flushedDeleted = new Set(deleted);
		dirty.clear();
		deleted.clear();
		flushPromise = collection.bulkWrite(ops, { ordered: false })
			.then(() => { flushPromise = null; })
			.catch((err) => {
				// keep the keys dirty so the next flush retries them
				for (const k of flushedDirty) dirty.add(k);
				for (const k of flushedDeleted) deleted.add(k);
				flushPromise = null;
				console.error(`[db] mongo flush failed (${collection.collectionName || 'collection'}): ${err.message}`);
				throw err;
			});
		return flushPromise;
	}

	return {
		kind: 'mongodb',
		load() {
			if (loaded) return Promise.resolve();
			if (loadPromise) return loadPromise;
			loadPromise = (async () => {
				const docs = await collection.find({}).toArray();
				for (const doc of docs) {
					const { key, value } = decode(doc);
					if (key) cache.set(key, value);
				}
				loaded = true;
			})();
			return loadPromise;
		},
		get(key) { return cache.get(String(key)); },
		set(key, value) {
			key = String(key);
			cache.set(key, value);
			deleted.delete(key);
			dirty.add(key);
			scheduleFlush();
		},
		delete(key) {
			key = String(key);
			cache.delete(key);
			dirty.delete(key);
			deleted.add(key);
			scheduleFlush();
		},
		getAll() { return [...cache.values()]; },
		entries() { return [...cache.entries()]; },
		async flush() {
			if (timer) { clearTimeout(timer); timer = null; }
			await doFlush();
		},
		async close() { await this.flush(); }
	};
}

function createStore(kind, opts) {
	if (kind === 'mongodb') {
		if (!opts || !opts.collection) throw new Error('mongo store needs a collection');
		return mongoStore(opts);
	}
	if (kind === 'json') {
		if (!opts || !opts.filePath) throw new Error('json store needs a filePath');
		return jsonStore(opts);
	}
	throw new Error(`unknown store kind "${kind}"`);
}

module.exports = { createStore };
