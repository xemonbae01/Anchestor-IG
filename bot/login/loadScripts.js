'use strict';

const fs = require('fs');
const path = require('path');

const cmdsDir = path.join(__dirname, '..', '..', 'scripts', 'cmds');
const eventsDir = path.join(__dirname, '..', '..', 'scripts', 'events');

function log() {
	return (global.utils && global.utils.log) || console;
}

function isLoadable(file) {
	if (!file.endsWith('.js')) return false;
	if (file.endsWith('.eg.js')) return false; // examples never load
	if (process.env.NODE_ENV === 'production' && file.endsWith('dev.js')) return false;
	return true;
}

function validateModule(mod) {
	if (!mod || typeof mod !== 'object') throw new Error('module exports nothing');
	if (!mod.config || typeof mod.config !== 'object') throw new Error('missing config');
	if (!mod.config.name) throw new Error('missing config.name');
	if (!mod.config.category) throw new Error('missing config.category');
	if (typeof mod.onStart !== 'function' && typeof mod.onChat !== 'function' && typeof mod.onEvent !== 'function')
		throw new Error('missing onStart/onChat/onEvent');
	return mod.config.name.toLowerCase();
}

// the registry. one record per loaded file, commands and events are separate
// worlds (a command and an event can share a name without killing each other):
// { kind, file, name, key, aliasesOwned, shadowed, dormant, module }
// key = the slot the module owns in Anchestor.commands / eventCommands,
// for a shadowed command that is its first free alias instead of the name
function records() {
	const A = global.Anchestor;
	if (!A.modulesByFile) A.modulesByFile = new Map();
	if (!A.collisions) A.collisions = [];
	return A.modulesByFile;
}

function ownerOf(key) {
	const recs = records();
	for (const r of recs.values())
		if (r.kind === 'command' && r.key === key) return r.file;
	const target = global.Anchestor.aliases.get(key);
	if (target)
		for (const r of recs.values())
			if (r.kind === 'command' && r.key === target) return r.file;
	return key;
}

function pushCollision(type, key, loserFile) {
	global.Anchestor.collisions.push({ type, key, winner: ownerOf(key), loser: loserFile });
}

// remove exactly what one file registered, nothing of anyone else's
function unregisterRecord(record) {
	const A = global.Anchestor;
	if (record.kind === 'command') {
		if (record.key && A.commands.get(record.key) === record.module) A.commands.delete(record.key);
		for (const alias of record.aliasesOwned)
			if (record.key && A.aliases.get(alias) === record.key) A.aliases.delete(alias);
		A.onChat = A.onChat.filter((m) => m !== record.module);
		A.onFirstChat = A.onFirstChat.filter((m) => m !== record.module);
	}
	else {
		if (record.key && A.eventCommands.get(record.key) === record.module) A.eventCommands.delete(record.key);
		A.onEvent = A.onEvent.filter((m) => m !== record.module);
		A.onAnyEvent = A.onAnyEvent.filter((m) => m !== record.module);
	}
	records().delete(`${record.kind}:${record.file}`);
	if (record.module) record.module.__registryKey = null;
}

function registerCommand(mod, file) {
	const A = global.Anchestor;
	const recs = records();
	const recKey = `command:${file}`;
	const old = recs.get(recKey);
	if (old) unregisterRecord(old); // reload of the same file starts clean

	const name = validateModule(mod);
	const record = {
		kind: 'command', file, name, key: null,
		aliasesOwned: [], shadowed: false, dormant: false, module: mod
	};

	// first come first served: the first file to claim a name keeps it,
	// a name that is already somebody's alias loses too
	if (!A.commands.has(name) && !A.aliases.has(name)) {
		record.key = name;
	}
	else {
		record.shadowed = true;
		pushCollision('name', name, file);
		log().warn('SCRIPTS', `"${name}" is already taken by ${ownerOf(name)}, ${file} loads shadowed`);
	}

	// aliases are claimed one by one, a taken alias is skipped, the rest live
	const declared = [...new Set((mod.config.aliases || []).map((a) => String(a).toLowerCase()))];
	for (const alias of declared) {
		if (alias === name && record.key === name) continue; // points at itself
		if (A.commands.has(alias) || A.aliases.has(alias)) {
			pushCollision('alias', alias, file);
			log().warn('SCRIPTS', `alias "${alias}" of ${file} already taken, skipped`);
			continue;
		}
		record.aliasesOwned.push(alias);
	}

	if (record.shadowed) {
		if (record.aliasesOwned.length) record.key = record.aliasesOwned[0];
		else {
			record.dormant = true;
			log().warn('SCRIPTS', `${file}: "${name}" is taken and no free alias is left, loaded dormant`);
		}
	}

	if (record.key) {
		A.commands.set(record.key, mod);
		for (const alias of record.aliasesOwned) A.aliases.set(alias, record.key);
	}
	mod.__registryKey = record.key;
	mod.__file = file;
	mod.__shadowed = record.shadowed;
	mod.__dormant = record.dormant;

	// hooks are per module, not per name, so shadowed modules still work
	if (typeof mod.onChat === 'function' && !A.onChat.includes(mod)) A.onChat.push(mod);
	if (typeof mod.onFirstChat === 'function' && !A.onFirstChat.includes(mod)) A.onFirstChat.push(mod);

	recs.set(recKey, record);
	return record;
}

function registerEvent(mod, file) {
	const A = global.Anchestor;
	const recs = records();
	const recKey = `event:${file}`;
	const old = recs.get(recKey);
	if (old) unregisterRecord(old);

	const name = validateModule(mod);
	const record = {
		kind: 'event', file, name, key: null,
		aliasesOwned: [], shadowed: false, dormant: false, module: mod
	};

	if (!A.eventCommands.has(name)) {
		record.key = name;
		A.eventCommands.set(name, mod);
	}
	else {
		record.shadowed = true;
		pushCollision('event', name, file);
		log().warn('SCRIPTS', `event "${name}" already taken, ${file} loads shadowed (hooks still run)`);
	}
	mod.__registryKey = record.key;
	mod.__file = file;
	mod.__shadowed = record.shadowed;

	if (typeof mod.onEvent === 'function' && !A.onEvent.includes(mod)) A.onEvent.push(mod);
	if (typeof mod.onStart === 'function' && !A.onAnyEvent.includes(mod)) A.onAnyEvent.push(mod);

	recs.set(recKey, record);
	return record;
}

function loadOneCommand(fileName, fresh = false) {
	const filePath = path.join(cmdsDir, fileName);
	if (fresh) delete require.cache[require.resolve(filePath)];
	const mod = require(filePath);
	return registerCommand(mod, fileName);
}

function loadOneEvent(fileName, fresh = false) {
	const filePath = path.join(eventsDir, fileName);
	if (fresh) delete require.cache[require.resolve(filePath)];
	const mod = require(filePath);
	return registerEvent(mod, fileName);
}

// custom aliases saved with the setalias data (Elite feature), applied after
// the files through the same first-come rules
function applySetAliases() {
	const A = global.Anchestor;
	const gd = global.db && global.db.globalData;
	if (!gd || typeof gd.peek !== 'function') return;
	let saved;
	try { saved = gd.peek('setalias'); } catch { return; }
	if (!Array.isArray(saved)) return;
	for (const item of saved) {
		if (!item || !item.commandName || !Array.isArray(item.aliases)) continue;
		const targetName = String(item.commandName).toLowerCase();
		const candidates = [...records().values()].filter((r) => r.kind === 'command' && r.name === targetName && r.key);
		const target = candidates.find((r) => !r.shadowed) || candidates[0];
		if (!target) {
			log().warn('SCRIPTS', `setalias: command "${targetName}" is not loaded, skipped`);
			continue;
		}
		for (const rawAlias of item.aliases) {
			const alias = String(rawAlias).toLowerCase();
			if (A.commands.has(alias) || A.aliases.has(alias)) {
				pushCollision('alias', alias, 'setalias');
				log().warn('SCRIPTS', `setalias alias "${alias}" already taken, skipped`);
				continue;
			}
			A.aliases.set(alias, target.key);
			target.aliasesOwned.push(alias);
		}
	}
}

// auto load scripts: watch both folders and reload just the changed file
let watchersStarted = false;
const pendingReloads = {};

function scheduleReload(kind, file) {
	if (!file || !isLoadable(file)) return;
	const cfg = (global.Anchestor.config && global.Anchestor.config.autoLoadScripts) || {};
	const ignoreRaw = kind === 'command' ? cfg.ignoreCmds : cfg.ignoreEvents;
	const ignore = String(ignoreRaw || '').split(/[\s,]+/).filter(Boolean);
	if (ignore.includes(file) || ignore.includes(file.replace(/\.js$/, ''))) return;
	const wkey = `${kind}:${file}`;
	if (pendingReloads[wkey]) clearTimeout(pendingReloads[wkey]);
	pendingReloads[wkey] = setTimeout(() => {
		delete pendingReloads[wkey];
		const dir = kind === 'command' ? cmdsDir : eventsDir;
		try {
			if (!fs.existsSync(path.join(dir, file))) {
				const rec = records().get(wkey);
				if (rec) {
					unregisterRecord(rec);
					log().info('SCRIPTS', `auto load: ${file} was deleted, unloaded`);
				}
				return;
			}
			if (kind === 'command') loadOneCommand(file, true);
			else loadOneEvent(file, true);
			log().info('SCRIPTS', `auto load: reloaded ${file}`);
		}
		catch (err) {
			log().error('SCRIPTS', `auto load failed for ${file}: ${err.message}`);
		}
	}, 400);
	if (pendingReloads[wkey].unref) pendingReloads[wkey].unref();
}

function ensureWatchers() {
	if (watchersStarted) return;
	const cfg = (global.Anchestor.config && global.Anchestor.config.autoLoadScripts) || {};
	if (!cfg.enable) return;
	watchersStarted = true;
	try {
		fs.watch(cmdsDir, (_ev, file) => { if (file) scheduleReload('command', String(file)); });
		fs.watch(eventsDir, (_ev, file) => { if (file) scheduleReload('event', String(file)); });
		log().info('SCRIPTS', 'auto load scripts is on, watching scripts/cmds and scripts/events');
	}
	catch (err) {
		log().error('SCRIPTS', `auto load watcher failed: ${err.message}`);
	}
}

async function loadScripts(_api) {
	const A = global.Anchestor;
	const cfgCmds = A.configCommands || {};
	const unloadCmds = cfgCmds.commandUnload || [];
	const unloadEvents = cfgCmds.commandEventUnload || [];

	A.commands.clear();
	A.eventCommands.clear();
	A.aliases.clear();
	A.onChat = [];
	A.onFirstChat = [];
	A.onEvent = [];
	A.onAnyEvent = [];
	A.collisions = [];
	records().clear();

	for (const file of fs.readdirSync(cmdsDir).sort()) {
		if (!isLoadable(file)) continue;
		if (unloadCmds.includes(file.replace(/\.js$/, '')) || unloadCmds.includes(file)) continue;
		try {
			loadOneCommand(file);
		}
		catch (err) {
			// one bad file shouldn't kill the whole boot
			log().error('SCRIPTS', `failed to load command ${file}: ${err.message}`);
		}
	}

	for (const file of fs.readdirSync(eventsDir).sort()) {
		if (!isLoadable(file)) continue;
		if (unloadEvents.includes(file.replace(/\.js$/, '')) || unloadEvents.includes(file)) continue;
		try {
			loadOneEvent(file);
		}
		catch (err) {
			log().error('SCRIPTS', `failed to load event ${file}: ${err.message}`);
		}
	}

	applySetAliases();
	ensureWatchers();

	const recs = [...records().values()];
	const cmdRecs = recs.filter((r) => r.kind === 'command');
	const counts = {
		commands: A.commands.size,
		events: A.eventCommands.size,
		shadowed: cmdRecs.filter((r) => r.shadowed && !r.dormant).length,
		dormant: cmdRecs.filter((r) => r.dormant).length,
		eventShadowed: recs.filter((r) => r.kind === 'event' && r.shadowed).length
	};
	log().success('SCRIPTS', `${counts.commands} commands and ${counts.events} events loaded (${counts.shadowed} shadowed, ${counts.dormant} dormant)`);
	return counts;
}

function getRegistryReport() {
	const A = global.Anchestor;
	const pub = (r) => ({
		name: r.name, file: r.file, key: r.key,
		aliases: [...r.aliasesOwned], shadowed: r.shadowed, dormant: r.dormant
	});
	const recs = [...records().values()];
	return {
		commands: recs.filter((r) => r.kind === 'command').map(pub),
		events: recs.filter((r) => r.kind === 'event').map(pub),
		collisions: [...(A.collisions || [])]
	};
}

// unload accepts a name, a registry key or any working alias of the module
function findCommandRecord(input) {
	const name = String(input).toLowerCase();
	const recs = [...records().values()].filter((r) => r.kind === 'command');
	let found = recs.find((r) => r.key === name);
	if (found) return found;
	const viaAlias = global.Anchestor.aliases.get(name);
	if (viaAlias) {
		found = recs.find((r) => r.key === viaAlias);
		if (found) return found;
	}
	return recs.find((r) => r.name === name && !r.shadowed) || recs.find((r) => r.name === name) || null;
}

function loadCommand(name) {
	const file = `${String(name).toLowerCase()}.js`;
	if (!fs.existsSync(path.join(cmdsDir, file))) throw new Error(`command file ${file} not found`);
	return loadOneCommand(file, true).name;
}

function unloadCommand(input) {
	const record = findCommandRecord(input);
	if (!record) throw new Error(`command "${input}" is not loaded`);
	unregisterRecord(record);
	return record.name;
}

function reloadCommand(name) {
	const file = `${String(name).toLowerCase()}.js`;
	if (fs.existsSync(path.join(cmdsDir, file))) return loadOneCommand(file, true).name;
	const record = findCommandRecord(name);
	if (!record) throw new Error(`command file ${file} not found`);
	return loadOneCommand(record.file, true).name;
}

function unloadEvent(input) {
	const name = String(input).toLowerCase();
	const recs = [...records().values()].filter((r) => r.kind === 'event');
	const record = recs.find((r) => r.key === name) || recs.find((r) => r.name === name);
	if (!record) throw new Error(`event "${input}" is not loaded`);
	unregisterRecord(record);
	return record.name;
}

module.exports = loadScripts;
module.exports.loadScripts = loadScripts;
module.exports.loadCommand = loadCommand;
module.exports.unloadCommand = unloadCommand;
module.exports.reloadCommand = reloadCommand;
module.exports.unloadEvent = unloadEvent;
module.exports.loadOneCommand = loadOneCommand;
module.exports.loadOneEvent = loadOneEvent;
module.exports.getRegistryReport = getRegistryReport;
module.exports.unregisterRecord = unregisterRecord;
