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
	onReaction: new Map(),
	onAnyEvent: [],
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

global.utils.log.master('Anchestor', 'anchestor is starting...');

require('./bot/login/login');
