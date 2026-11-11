'use strict';

const { createMessage } = require('./handlerAction');
const handlerCheckData = require('./handlerCheckData');
const { getRole } = require('./handlerCheckData');
const replyStore = require('./replyStore');

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

// names and aliases both land here, shadowed modules resolve through the
// alias they own just like a normal command name
function resolveCommand(input) {
	const A = global.Anchestor;
	if (!input) return null;
	const name = String(input).toLowerCase();
	if (A.commands.has(name)) return A.commands.get(name);
	const via = A.aliases.get(name);
	if (via && A.commands.has(via)) return A.commands.get(via);
	return null;
}

function stamp(command) {
	replyStore.setCurrentKey(
		command ? (command.__registryKey || command.config.name) : null,
		command ? command.config.name : null
	);
}

// usage stats, kept in memory and flushed through the normal debounced save
function recordUsage(command) {
	try {
		const A = global.Anchestor;
		const gd = global.db && global.db.globalData;
		if (!A._usageCache) {
			const saved = gd && typeof gd.peek === 'function' ? gd.peek('commandUsage') : null;
			const total = gd && typeof gd.peek === 'function' ? gd.peek('commandUsageTotal') : 0;
			A._usageCache = { ...(saved || {}) };
			A._usageTotal = Number(total) || 0;
		}
		const name = command.config.name;
		A._usageCache[name] = (A._usageCache[name] || 0) + 1;
		A._usageTotal++;
		if (gd) {
			gd.set('commandUsage', { ...A._usageCache });
			gd.set('commandUsageTotal', A._usageTotal);
		}
	}
	catch { /* stats never break a command */ }
}

async function runEventCommands({ api, event, message, role, prefix }) {
	// thread level events go to scripts/events
	const A = global.Anchestor;
	const ctxBase = { api, event, message, role, prefix };
	for (const ev of [...A.onAnyEvent]) {
		stamp(ev);
		try { await ev.onStart({ ...ctxBase, threadsData: global.db.threadsData, usersData: global.db.usersData, globalData: global.db.globalData, commandName: ev.config.name, getLang: buildGetLang(ev, prefix, ev.config.name) }); }
		catch (err) { global.utils.log.error('EVENT', `${ev.config.name}: ${err.stack || err.message}`); }
	}
	for (const ev of [...A.onEvent]) {
		stamp(ev);
		try { await ev.onEvent({ ...ctxBase, threadsData: global.db.threadsData, usersData: global.db.usersData, globalData: global.db.globalData, commandName: ev.config.name, getLang: buildGetLang(ev, prefix, ev.config.name) }); }
		catch (err) { global.utils.log.error('EVENT', `${ev.config.name}: ${err.stack || err.message}`); }
	}
}

// shared runner for quote-reply entries and reply sessions
async function runReplyFlow({ api, event, message, role, prefix, entry, kind }) {
	const A = global.Anchestor;
	let command = entry.__key ? A.commands.get(entry.__key) : null;
	if (!command || typeof command.onReply !== 'function') command = resolveCommand(entry.commandName);
	if (!command || typeof command.onReply !== 'function') return false;
	const Reply = replyStore.helpersFor(entry, kind);
	const ctx = makeContext({
		api, event, message, command, commandName: command.config.name,
		args: event.body.trim().split(/\s+/).filter(Boolean), role, prefix,
		extra: { onReply: entry, Reply, isSession: kind === 'session' }
	});
	message._commandName = command.config.name;
	message._guideText = guideTextOf(command);
	stamp(command);
	try {
		const handled = await command.onReply(ctx);
		if (handled) {
			replyStore.afterCall(entry, kind);
			return true;
		}
	}
	catch (err) {
		global.utils.log.error('onReply', `${command.config.name}: ${err.stack || err.message}`);
		Reply.end();
		await message.reply(`⚠️ ${command.config.name} hit an error: ${err.message}`);
		return true;
	}
	return false;
}

function entryMatches(entry, event) {
	if (entry.threadID && String(entry.threadID) !== String(event.threadID)) return false;
	if (!entry.allowAnyone && entry.author && String(entry.author) !== String(event.senderID)) return false;
	return true;
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
			const command = (entry.__key && A.commands.get(entry.__key)) || resolveCommand(entry.commandName);
			if (command && typeof command.onReaction === 'function') {
				const ctx = makeContext({
					api, event, message, command, commandName: command.config.name,
					args: [], role, prefix, extra: { onReaction: entry, reaction: event.reaction }
				});
				message._commandName = command.config.name;
				message._guideText = guideTextOf(command);
				stamp(command);
				try { await command.onReaction(ctx); }
				catch (err) { global.utils.log.error('onReaction', `${command.config.name}: ${err.stack || err.message}`); }
			}
		}
		return;
	}

	if (event.type !== 'message') {
		// unsends etc still reach event scripts as any-event
		if (event.type === 'message_unsend') await runEventCommands({ api, event, message, role, prefix });
		return;
	}

	// pipeline from here: quote replies -> reply sessions -> onChat -> command

	// replies bound to a sent message (author locked, thread locked, ttl)
	if (event.messageReply && event.messageReply.messageID) {
		const entry = replyStore.getEntry(event.messageReply.messageID);
		if (entry && entryMatches(entry, event)) {
			if (await runReplyFlow({ api, event, message, role, prefix, entry, kind: 'reply' })) return;
		}
	}

	const isPrefixed = Boolean(prefix) && event.body.startsWith(prefix);

	// reply sessions: the author's next plain message continues the flow,
	// a prefixed message always wins and goes to the command parser instead
	if (!isPrefixed) {
		const session = replyStore.getSession(event.threadID, event.senderID);
		if (session && entryMatches(session, event)) {
			if (await runReplyFlow({ api, event, message, role, prefix, entry: session, kind: 'session' })) return;
		}
	}

	// onChat triggers (e.g. typing "prefix" with no dash)
	for (const cmd of [...A.onChat]) {
		const ctx = makeContext({
			api, event, message, command: cmd, commandName: cmd.config.name,
			args: event.body.trim().split(/\s+/).filter(Boolean), role, prefix
		});
		stamp(cmd);
		try {
			const handled = await cmd.onChat(ctx);
			if (handled === true) return;
		}
		catch (err) { global.utils.log.error('onChat', `${cmd.config.name}: ${err.stack || err.message}`); }
	}

	// not a command
	if (!isPrefixed) return;

	const withoutPrefix = event.body.slice(prefix.length).trim();
	if (!withoutPrefix) return;
	const parts = withoutPrefix.split(/\s+/);
	const rawName = parts[0].toLowerCase();
	const args = parts.slice(1);
	const command = resolveCommand(rawName);

	if (!command) {
		if (config.hideNotiMessage && config.hideNotiMessage.commandNotFound) return;
		const candidates = [];
		for (const [key, mod] of A.commands.entries()) {
			candidates.push({ name: key, display: mod.config.name });
			for (const alias of (mod.config.aliases || [])) candidates.push({ name: alias, display: mod.config.name });
		}
		for (const [alias, key] of A.aliases.entries()) {
			const mod = A.commands.get(key);
			if (mod) candidates.push({ name: alias, display: mod.config.name });
		}
		const found = global.utils.suggest(rawName, candidates, 3);
		if (found.length)
			await message.reply(`Command "${rawName}" not found. Did you mean: ${found.map((n) => `${prefix}${n}`).join(', ')}?`);
		else
			await message.reply(global.utils.getText('handlerEvents', 'commandNotFound', rawName).split('{p}').join(prefix));
		return;
	}

	message._commandName = command.config.name;
	message._guideText = guideTextOf(command);
	stamp(command);
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

	// cooldown, per command + thread + sender, bot admins skip it
	const cdSec = Number(command.config.countDown || 0);
	if (cdSec > 0 && role < 2) {
		const keyCd = `${command.config.name}_${event.threadID}_${event.senderID}`;
		const last = global.client.countDown[keyCd] || 0;
		const waitMs = last + cdSec * 1000 - Date.now();
		if (waitMs > 0)
			return message.reply(global.utils.getText('handlerEvents', 'cooldown', Math.ceil(waitMs / 1000), command.config.name));
		global.client.countDown[keyCd] = Date.now();
	}

	try {
		await command.onStart(ctx);
		recordUsage(command);
	}
	catch (err) {
		global.utils.log.error('COMMAND', `${command.config.name}: ${err.stack || err.message}`);
		await message.reply(`⚠️ ${command.config.name} hit an error: ${err.message}`);
	}
}

module.exports = handlerEvents;
module.exports.handlerEvents = handlerEvents;
module.exports.getRole = getRole;
module.exports.resolveCommand = resolveCommand;
