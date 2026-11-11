'use strict';

const fs = require('fs');
const path = require('path');

// zero config json store. in-memory object + debounced writes (tmp + rename)
// every write keeps the previous good content in <file>.bak, and a corrupt
// main file falls back to that backup on load instead of crashing the boot
const timers = {};
const chains = {}; // per file promise chain, writes never overlap

function tryParse(raw) {
	if (!raw || !raw.trim()) return undefined;
	try { return JSON.parse(raw); }
	catch { return undefined; }
}

function readStore(filePath, defaultValue) {
	if (fs.existsSync(filePath)) {
		const parsed = tryParse(fs.readFileSync(filePath, 'utf8'));
		if (parsed !== undefined) return parsed;
		// main file is corrupt, try the backup before giving up
		const bak = `${filePath}.bak`;
		if (fs.existsSync(bak)) {
			const fromBak = tryParse(fs.readFileSync(bak, 'utf8'));
			if (fromBak !== undefined) {
				console.error(`[db] ${filePath} is corrupt, recovered from ${bak}`);
				return fromBak;
			}
		}
		console.error(`[db] ${filePath} is corrupt and no backup works, starting fresh`);
	}
	return defaultValue;
}

function writeStoreNow(filePath, data) {
	if (timers[filePath]) {
		clearTimeout(timers[filePath]);
		delete timers[filePath];
	}
	// serialize per file: chain each write behind the previous one
	chains[filePath] = (chains[filePath] || Promise.resolve()).then(() => {
		try {
			fs.mkdirSync(path.dirname(filePath), { recursive: true });
			if (fs.existsSync(filePath)) {
				try { fs.copyFileSync(filePath, `${filePath}.bak`); } catch { /* backup is best effort */ }
			}
			const tmp = `${filePath}.tmp`;
			fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
			fs.renameSync(tmp, filePath);
		}
		catch (err) {
			console.error(`[db] failed to save ${filePath}: ${err.message}`);
		}
	});
	return chains[filePath];
}

function saveStore(filePath, data, delayMs = 250) {
	if (timers[filePath]) clearTimeout(timers[filePath]);
	timers[filePath] = setTimeout(() => {
		delete timers[filePath];
		writeStoreNow(filePath, data);
	}, delayMs);
	// don't keep the process alive just for a pending save
	if (timers[filePath].unref) timers[filePath].unref();
}

// write right now and wait for it (shutdown, tests)
async function flushStore(filePath, data) {
	await writeStoreNow(filePath, data);
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

module.exports = { readStore, writeStoreNow, saveStore, flushStore, getPath, setPath };
