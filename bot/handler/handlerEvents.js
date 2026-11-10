'use strict';

const { createMessage } = require('./handlerAction');
const handlerCheckData = require('./handlerCheckData');
const { getRole } = require('./handlerCheckData');

function buildGetLang(command, prefix, commandName) {
	return function getLang(key, ...args) {
		const lang = (global.Anchestor.config && global.Anchestor.config.language) || 'en';
		const langs = (command && command.langs) || {};
		let text = (langs[lang] && langs[lang][key]) ?? (langs.en && langs.en[key]);
		if (text === undefined) return key;
		text = String(text);
		args.forEach((arg, i) => {
			text = text.replace(new RegExp(`%${i + 1}`, 'g'), String(arg));
		});
		text = text.split('{p}').join(prefix || '');
		text = text.split('{n}').join(commandName || '');
		text = text.split('{pn}').join(`${prefix || ''}${commandName || ''}`);
		return text;
	};
}

function guideTextOf(command) {
	if (!command || !command.config) return null;
	const guide = command.config.guide;
	if (!guide) return null;
	if (typeof guide === 'string') return guide;
	return guide.en || Object.values(guide)[0] || null;
}

function makeContext({ api, event, message, command, commandName, args, role, prefix, extra = {} }) {
	return {
		api,
		message,
		event,
		args: args || [],
		threadsData: global.db.threadsData,
		usersData: global.db.usersData,
		globalData: global.db.globalData,
		commandName,
		getLang: buildGetLang(command, prefix, commandName),
		role,
		prefix,
		...extra
	};
}

async function runEventCommands({ api, event, message, role, prefix }) {
	// thread level events go to scripts/events
	const A = global.Anchestor;
	const ctxBase = { api, event, message, role, prefix };
	for (const ev of [...A.onAnyEvent]) {
		try { await ev.onStart({ ...ctxBase, threadsData: global.db.threadsData, usersData: global.db.usersData, globalData: global.db.globalData, commandName: ev.config.name, getLang: buildGetLang(ev, prefix, ev.config.name) }); }
		catch (err) { global.utils.log.error('EVENT', `${ev.config.name}: ${err.message}`); }
	}
	for (const ev of [...A.onEvent]) {
		try { await ev.onEvent({ ...ctxBase, threadsData: global.db.threadsData, usersData: global.db.usersData, globalData: global.db.globalData, commandName: ev.config.name, getLang: buildGetLang(ev, prefix, ev.config.name) }); }
		catch (err) { global.utils.log.error('EVENT', `${ev.config.name}: ${err.message}`); }
	}
}

async function handlerEvents({ api, event }) {
	const A = global.Anchestor;
	const config = A.config || {};
	if (!event || !event.threadID) return;

	// db might not be wired in tests that skip loadData
	if (!global.db.threadsData) {
		global.db.threadsData = require('../../database/controller/threadsData');
		global.db.usersData = require('../../database/controller/usersData');
		global.db.globalData = require('../../database/controller/globalData');
	}
	const { threadsData, usersData } = global.db;

	const message = createMessage(api, event);
	event.body = event.body || '';

	try {
		await handlerCheckData({ event, threadsData, usersData });
	}
	catch (err) {
		global.utils.log.error('CHECK DATA', err.message);
	}

	const threadData = await threadsData.get(event.threadID);
	const prefix = global.utils.getPrefix(event.threadID);
	const role = getRole(threadData, event.senderID);

	// thread updates and friends go straight to event scripts
	if (event.type === 'event' || event.type === 'thread_update') {
		await runEventCommands({ api, event, message, role, prefix });
		return;
	}

	// banned checks (bot admins never get blocked)
	if (role < 2 && event.senderID) {
		const userData = await usersData.get(event.senderID);
		if (userData && userData.banned && userData.banned.status) {
			if (event.type === 'message')
				await message.reply(global.utils.getText('handlerEvents', 'userBanned') +
					(userData.banned.reason ? `\n${global.utils.getText('handlerEvents', 'reason', userData.banned.reason)}` : ''));
			return;
		}
	}
	if (role < 2 && threadData && threadData.banned && threadData.banned.status && event.type === 'message') {
		await message.reply(global.utils.getText('handlerEvents', 'threadBanned'));
		return;
	}

	// whitelist mode
	if (role < 2 && config.whiteListMode && config.whiteListMode.enable && event.type === 'message') {
		const list = (config.whiteListMode.whiteListIds || []).map(String);
		if (!list.includes(String(event.senderID))) return;
	}
	if (role < 2 && config.whiteListModeThread && config.whiteListModeThread.enable && event.type === 'message') {
		const list = (config.whiteListModeThread.whiteListThreadIds || []).map(String);
		if (!list.includes(String(event.threadID)))
			return message.reply(global.utils.getText('handlerEvents', 'notInWhiteList'));
	}

	// reactions bound to a sent message (-prefix confirm etc)
	if (event.type === 'message_reaction') {
		const entry = A.onReaction.get(event.messageID);
		if (entry) {
			if (entry.senderID && String(entry.senderID) !== String(event.senderID)) return;
			const command = A.commands.get(entry.commandName);
			if (command && typeof command.onReaction === 'function') {
				const ctx = makeContext({
					api, event, message, command, commandName: entry.commandName,
					args: [], role, prefix, extra: { onReaction: entry, reaction: event.reaction }
				});
				message._commandName = entry.commandName;
				message._guideText = guideTextOf(command);
				try { await command.onReaction(ctx); }
				catch (err) { global.utils.log.error('onReaction', `${entry.commandName}: ${err.message}`); }
			}
		}
		return;
	}

	if (event.type !== 'message') {
		// unsends etc still reach event scripts as any-event
		if (event.type === 'message_unsend') await runEventCommands({ api, event, message, role, prefix });
		return;
	}

	// replies bound to a sent message
	if (event.messageReply && event.messageReply.messageID) {
		const entry = A.onReply.get(event.messageReply.messageID);
		if (entry) {
			const command = A.commands.get(entry.commandName);
			if (command && typeof command.onReply === 'function') {
				const ctx = makeContext({
					api, event, message, command, commandName: entry.commandName,
					args: event.body.trim().split(/\s+/).filter(Boolean), role, prefix,
					extra: { onReply: entry, Reply: entry }
				});
				message._commandName = entry.commandName;
				message._guideText = guideTextOf(command);
				try {
					const handled = await command.onReply(ctx);
					if (handled) return;
				}
				catch (err) { global.utils.log.error('onReply', `${entry.commandName}: ${err.message}`); }
			}
		}
	}

	// onChat triggers first (e.g. typing "prefix" with no dash)
	for (const cmd of [...A.onChat]) {
		const ctx = makeContext({
			api, event, message, command: cmd, commandName: cmd.config.name,
			args: event.body.trim().split(/\s+/).filter(Boolean), role, prefix
		});
		try {
			const handled = await cmd.onChat(ctx);
			if (handled === true) return;
		}
		catch (err) { global.utils.log.error('onChat', `${cmd.config.name}: ${err.message}`); }
	}

	// not a command
	if (!event.body.startsWith(prefix)) return;

	const withoutPrefix = event.body.slice(prefix.length).trim();
	if (!withoutPrefix) return;
	const parts = withoutPrefix.split(/\s+/);
	const rawName = parts[0].toLowerCase();
	const args = parts.slice(1);
	const commandName = A.aliases.get(rawName) || rawName;
	const command = A.commands.get(commandName);

	if (!command) {
		await message.reply(global.utils.getText('handlerEvents', 'commandNotFound', rawName).split('{p}').join(prefix));
		return;
	}

	message._commandName = command.config.name;
	message._guideText = guideTextOf(command);
	const ctx = makeContext({ api, event, message, command, commandName: command.config.name, args, role, prefix });

	// per thread banned commands from configCommands
	const bannedHere = (global.client.commandBanned || {})[event.threadID] || [];
	if (bannedHere.includes(command.config.name)) return;

	// admin only mode
	if (config.adminOnly && config.adminOnly.enable && role < 2) {
		const ignore = config.adminOnly.ignoreCommand || [];
		if (!ignore.includes(command.config.name))
			return message.reply(global.utils.getText('handlerEvents', 'adminOnly'));
	}

	// role gate
	const needRole = command.config.role || 0;
	if (needRole === 1 && role < 1) return message.reply(global.utils.getText('handlerEvents', 'onlyAdminBox'));
	if (needRole === 2 && role < 2) return message.reply(global.utils.getText('handlerEvents', 'onlyAdminBot'));

	// anti inbox: some setups don't want commands in dm
	if (config.antiInbox && !event.isGroup && role < 2) return;

	// cooldown
	const cdSec = Number(command.config.countDown || 0);
	if (cdSec > 0 && role < 2) {
		const keyCd = `${command.config.name}_${event.senderID}`;
		const last = global.client.countDown[keyCd] || 0;
		const waitMs = last + cdSec * 1000 - Date.now();
		if (waitMs > 0)
			return message.reply(global.utils.getText('handlerEvents', 'cooldown', Math.ceil(waitMs / 1000), command.config.name));
		global.client.countDown[keyCd] = Date.now();
	}

	try {
		await command.onStart(ctx);
	}
	catch (err) {
		global.utils.log.error('COMMAND', `${command.config.name}: ${err.stack || err.message}`);
		await message.reply(`Error in ${command.config.name}: ${err.message}`);
	}
}

module.exports = handlerEvents;
module.exports.handlerEvents = handlerEvents;
module.exports.getRole = getRole;
