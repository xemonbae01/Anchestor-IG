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

function validateModule(mod, fileName) {
	if (!mod || typeof mod !== 'object') throw new Error('module exports nothing');
	if (!mod.config || typeof mod.config !== 'object') throw new Error('missing config');
	if (!mod.config.name) throw new Error('missing config.name');
	if (!mod.config.category) throw new Error('missing config.category');
	if (typeof mod.onStart !== 'function' && typeof mod.onChat !== 'function' && typeof mod.onEvent !== 'function')
		throw new Error('missing onStart/onChat/onEvent');
	return mod.config.name.toLowerCase();
}

// remove what a loaded file registered, so reload is clean
// commands and events are separate worlds: a command and an event can share
// a name (leave the command vs leave the event) without killing each other
function unregisterCommand(name) {
	const A = global.Anchestor;
	if (A.commands.has(name)) {
		A.commands.delete(name);
		for (const [alias, target] of [...A.aliases.entries()])
			if (target === name) A.aliases.delete(alias);
		A.onChat = A.onChat.filter((c) => c.config.name !== name);
		A.onFirstChat = A.onFirstChat.filter((c) => c.config.name !== name);
	}
}

function unregisterEvent(name) {
	const A = global.Anchestor;
	if (A.eventCommands.has(name)) {
		A.eventCommands.delete(name);
		A.onEvent = A.onEvent.filter((c) => c.config.name !== name);
		A.onAnyEvent = A.onAnyEvent.filter((c) => c.config.name !== name);
	}
}

function unregister(name) {
	unregisterCommand(name);
	unregisterEvent(name);
}

function registerCommand(mod, name) {
	const A = global.Anchestor;
	A.commands.set(name, mod);
	const aliases = mod.config.aliases || [];
	for (const alias of aliases) {
		const a = String(alias).toLowerCase();
		if (A.aliases.has(a) || A.commands.has(a)) {
			log().warn('SCRIPTS', `alias "${a}" of ${name} already taken, skipped`);
			continue;
		}
		A.aliases.set(a, name);
	}
	if (typeof mod.onChat === 'function' && !A.onChat.find((c) => c.config.name === name)) A.onChat.push(mod);
	if (typeof mod.onFirstChat === 'function' && !A.onFirstChat.find((c) => c.config.name === name)) A.onFirstChat.push(mod);
}

function registerEvent(mod, name) {
	const A = global.Anchestor;
	A.eventCommands.set(name, mod);
	if (typeof mod.onEvent === 'function' && !A.onEvent.find((c) => c.config.name === name)) A.onEvent.push(mod);
	if (typeof mod.onStart === 'function' && !A.onAnyEvent.find((c) => c.config.name === name)) A.onAnyEvent.push(mod);
}

function loadOneCommand(fileName, fresh = false) {
	const filePath = path.join(cmdsDir, fileName);
	if (fresh) delete require.cache[require.resolve(filePath)];
	const mod = require(filePath);
	const name = validateModule(mod, fileName);
	unregisterCommand(name);
	registerCommand(mod, name);
	return name;
}

function loadOneEvent(fileName, fresh = false) {
	const filePath = path.join(eventsDir, fileName);
	if (fresh) delete require.cache[require.resolve(filePath)];
	const mod = require(filePath);
	const name = validateModule(mod, fileName);
	unregisterEvent(name);
	registerEvent(mod, name);
	return name;
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

	let cmdCount = 0;
	for (const file of fs.readdirSync(cmdsDir).sort()) {
		if (!isLoadable(file)) continue;
		if (unloadCmds.includes(file.replace(/\.js$/, '')) || unloadCmds.includes(file)) continue;
		try {
			loadOneCommand(file);
			cmdCount++;
		}
		catch (err) {
			// one bad file shouldn't kill the whole boot
			log().error('SCRIPTS', `failed to load command ${file}: ${err.message}`);
		}
	}

	let eventCount = 0;
	for (const file of fs.readdirSync(eventsDir).sort()) {
		if (!isLoadable(file)) continue;
		if (unloadEvents.includes(file.replace(/\.js$/, '')) || unloadEvents.includes(file)) continue;
		try {
			loadOneEvent(file);
			eventCount++;
		}
		catch (err) {
			log().error('SCRIPTS', `failed to load event ${file}: ${err.message}`);
		}
	}

	log().success('SCRIPTS', `${cmdCount} commands and ${eventCount} events loaded`);
	return { commands: cmdCount, events: eventCount };
}

// single file ops, used by the -cmd command
function loadCommand(name) {
	const file = `${name}.js`;
	if (!fs.existsSync(path.join(cmdsDir, file))) throw new Error(`command file ${file} not found`);
	return loadOneCommand(file, true);
}

function unloadCommand(name) {
	name = String(name).toLowerCase();
	if (!global.Anchestor.commands.has(name)) throw new Error(`command "${name}" is not loaded`);
	unregisterCommand(name);
	return name;
}

function reloadCommand(name) {
	unloadCommand(String(name).toLowerCase());
	return loadCommand(name);
}

module.exports = loadScripts;
module.exports.loadScripts = loadScripts;
module.exports.loadCommand = loadCommand;
module.exports.unloadCommand = unloadCommand;
module.exports.reloadCommand = reloadCommand;
module.exports.loadOneCommand = loadOneCommand;
module.exports.loadOneEvent = loadOneEvent;
