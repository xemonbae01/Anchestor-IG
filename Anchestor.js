/**
 * @author xemonbae01
 * Developed By Redwan Ahemed https://GitHub.com/xemonbae01
 */

'use strict';

const fs = require('fs');
const path = require('path');

const rootDir = __dirname;

function loadJson(file, required = true) {
	const filePath = path.join(rootDir, file);
	if (!fs.existsSync(filePath)) {
		if (required) {
			console.error(`[Anchestor] missing ${file}`);
			process.exit(1);
		}
		return {};
	}
	try {
		return JSON.parse(fs.readFileSync(filePath, 'utf8'));
	}
	catch (err) {
		console.error(`[Anchestor] ${file} is not valid JSON: ${err.message}`);
		process.exit(1);
	}
}

const config = loadJson('config.json');
const configCommands = loadJson('configCommands.json');
const configIgApi = loadJson('configIgApi.json');

global.Anchestor = {
	startTime: Date.now(),
	commands: new Map(),
	eventCommands: new Map(),
	aliases: new Map(),
	onFirstChat: [],
	onChat: [],
	onEvent: [],
	onReply: new Map(),
	onReplySession: new Map(),
	onReaction: new Map(),
	onAnyEvent: [],
	modulesByFile: new Map(),
	collisions: [],
	shutdown: null,
	shutdownHooks: [],
	config,
	configCommands,
	configIgApi,
	envCommands: (configCommands && configCommands.envCommands) || {},
	envEvents: (configCommands && configCommands.envEvents) || {},
	envGlobal: (configCommands && configCommands.envGlobal) || {},
	igApi: null,
	botID: null
};

global.db = {
	allThreadData: [],
	allUserData: [],
	allGlobalData: {},
	threadsData: null,
	usersData: null,
	globalData: null
};

global.client = {
	dirConfig: path.join(rootDir, 'config.json'),
	dirConfigCommands: path.join(rootDir, 'configCommands.json'),
	dirAccount: path.join(rootDir, 'account.txt'),
	countDown: {},
	cache: {},
	commandBanned: (configCommands && configCommands.commandBanned) || {}
};

global.utils = require('./utils');
global.temp = {};

// hot reload the config files when they change on disk
let reloadTimer = null;
for (const file of ['config.json', 'configCommands.json', 'configIgApi.json']) {
	const filePath = path.join(rootDir, file);
	fs.watchFile(filePath, { interval: 1500 }, () => {
		if (reloadTimer) clearTimeout(reloadTimer);
		reloadTimer = setTimeout(() => {
			try {
				global.Anchestor.config = loadJson('config.json');
				global.Anchestor.configCommands = loadJson('configCommands.json');
				global.Anchestor.configIgApi = loadJson('configIgApi.json');
				global.Anchestor.envCommands = global.Anchestor.configCommands.envCommands || {};
				global.Anchestor.envEvents = global.Anchestor.configCommands.envEvents || {};
				global.Anchestor.envGlobal = global.Anchestor.configCommands.envGlobal || {};
				global.client.commandBanned = global.Anchestor.configCommands.commandBanned || {};
				global.utils.log.info('Anchestor', `${file} changed, config reloaded`);
			}
			catch (err) {
				global.utils.log.error('Anchestor', `failed to reload config: ${err.message}`);
			}
		}, 300);
	});
}

// auto restart on a timer if config asks for it (ms)
if (config.autoRestart && config.autoRestart.time) {
	const time = Number(config.autoRestart.time);
	if (time > 0) {
		setTimeout(() => {
			global.utils.log.info('Anchestor', global.utils.getText('Anchestor', 'autoRestart1', `${time}ms`));
			process.exit(2);
		}, time);
	}
}

// light config sanity check, warnings only — a bad value shouldn't kill boot
{
	const warn = (msg) => global.utils.log.warn('CONFIG', msg);
	if (typeof config.prefix !== 'string' || !config.prefix)
		warn('config.prefix should be a non-empty string, commands may not parse');
	if (!Array.isArray(config.adminBot))
		warn('config.adminBot should be an array of user ids');
	const dbType = ((config.database || {}).type || 'json').toLowerCase();
	if (!['json', 'sqlite', 'mongodb'].includes(dbType))
		warn(`config.database.type "${dbType}" is unknown, expected json/sqlite/mongodb`);
	if (config.autoLoadScripts !== undefined && typeof config.autoLoadScripts !== 'object')
		warn('config.autoLoadScripts should be an object like { enable: false }');
}

// reply entries expire on their own, sweep the leftovers now and then
require('./bot/handler/replyStore').startSweeper();

// graceful shutdown: disconnect the client, flush the json db, exit 0
// (index.js only restarts on exit code 2, so 0 stays down on purpose)
let shuttingDown = false;
async function gracefulShutdown(signal) {
	if (shuttingDown) return;
	shuttingDown = true;
	global.utils.log.info('Anchestor', `${signal} received, shutting down...`);
	try {
		if (typeof global.Anchestor.shutdown === 'function') await global.Anchestor.shutdown();
		for (const hook of global.Anchestor.shutdownHooks || []) {
			try { await hook(); } catch { /* one bad hook shouldn't block the rest */ }
		}
	}
	catch (err) {
		global.utils.log.error('Anchestor', `shutdown hook failed: ${err.message}`);
	}
	try {
		const flushes = [];
		for (const ctrl of [global.db.threadsData, global.db.usersData, global.db.globalData])
			if (ctrl && typeof ctrl._flush === 'function') flushes.push(ctrl._flush());
		await Promise.all(flushes);
		global.utils.log.success('Anchestor', 'database flushed, bye');
	}
	catch (err) {
		global.utils.log.error('Anchestor', `failed to flush database: ${err.message}`);
	}
	process.exit(0);
}
process.on('SIGINT', () => { gracefulShutdown('SIGINT'); });
process.on('SIGTERM', () => { gracefulShutdown('SIGTERM'); });

global.utils.log.master('Anchestor', 'anchestor is starting...');

require('./bot/login/login');
