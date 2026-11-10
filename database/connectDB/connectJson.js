'use strict';

const fs = require('fs');
const path = require('path');

// zero config json store. in-memory object + debounced atomic writes (tmp + rename)
const timers = {};

function readStore(filePath, defaultValue) {
	try {
		if (fs.existsSync(filePath)) {
			const raw = fs.readFileSync(filePath, 'utf8').trim();
			if (raw) return JSON.parse(raw);
		}
	}
	catch (err) {
		console.error(`[db] failed to read ${filePath}: ${err.message}, starting fresh`);
	}
	return defaultValue;
}

function writeStoreNow(filePath, data) {
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	const tmp = `${filePath}.tmp`;
	fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
	fs.renameSync(tmp, filePath);
}

function saveStore(filePath, data, delayMs = 250) {
	if (timers[filePath]) clearTimeout(timers[filePath]);
	timers[filePath] = setTimeout(() => {
		try { writeStoreNow(filePath, data); }
		catch (err) { console.error(`[db] failed to save ${filePath}: ${err.message}`); }
	}, delayMs);
	// don't keep the process alive just for a pending save
	if (timers[filePath].unref) timers[filePath].unref();
}

function getPath(obj, pathStr) {
	if (!pathStr) return obj;
	let cur = obj;
	for (const part of String(pathStr).split('.')) {
		if (cur === null || cur === undefined) return undefined;
		cur = cur[part];
	}
	return cur;
}

function setPath(obj, pathStr, value) {
	const parts = String(pathStr).split('.');
	let cur = obj;
	for (let i = 0; i < parts.length - 1; i++) {
		if (cur[parts[i]] === null || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
		cur = cur[parts[i]];
	}
	cur[parts[parts.length - 1]] = value;
	return obj;
}

module.exports = { readStore, writeStoreNow, saveStore, getPath, setPath };
