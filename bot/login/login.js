'use strict';

const fs = require('fs');
const path = require('path');

const loadData = require('./loadData');
const loadScripts = require('./loadScripts');
const handlerEvents = require('../handler/handlerEvents');
const handlerWhenListenHasError = require('./handlerWhenListenHasError');

const rootDir = path.join(__dirname, '..', '..');

// thread info cache, ig doesn't push full thread data with every message
const threadCache = new Map();

function readJsonIfExists(filePath) {
	try {
		if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf8'));
	}
	catch (err) {
		global.utils.log.error('LOGIN', `failed to parse ${filePath}: ${err.message}`);
	}
	return null;
}

// session can come from env, data/session.json or account.txt (same json format)
function resolveSessionOptions(config, configIgApi) {
	const igCfg = config.instagram || {};
	const sessionPath = path.resolve(rootDir, process.env.IG_SESSION_PATH || igCfg.sessionPath || 'data/session.json');
	const opts = {
		sessionPath,
		pollIntervalMs: Number(igCfg.pollIntervalMs || configIgApi.pollIntervalMs || 3000),
		requestTimeoutMs: Number(configIgApi.requestTimeoutMs || 15000),
		maxRetries: Number(configIgApi.maxRetries || 2),
		userAgent: configIgApi.userAgent || undefined,
		debug: Boolean(igCfg.debug)
	};

	if (process.env.IG_COOKIE_STRING) {
		opts.cookieString = process.env.IG_COOKIE_STRING;
		return opts;
	}
	if (process.env.IG_SESSION_ID) {
		opts.cookies = {
			sessionid: process.env.IG_SESSION_ID,
			csrftoken: process.env.IG_CSRF_TOKEN || '',
			ds_user_id: process.env.IG_USER_ID || ''
		};
		if (process.env.IG_USER_ID) opts.userId = process.env.IG_USER_ID;
		return opts;
	}

	if (!fs.existsSync(sessionPath)) {
		// fallback: account.txt holding the same { cookies: {...} } json
		const accountFile = path.join(rootDir, 'account.txt');
		const fromAccount = readJsonIfExists(accountFile);
		if (fromAccount) {
			if (fromAccount.cookies) opts.cookies = fromAccount.cookies;
			else if (fromAccount.sessionid) opts.cookies = fromAccount;
			if (fromAccount.userId) opts.userId = fromAccount.userId;
			global.utils.log.info('LOGIN', 'no session file found, using account.txt');
		}
	}
	return opts;
}

function userToPlain(u) {
	if (!u) return null;
	return {
		id: String(u.id || u.pk || ''),
		userID: String(u.id || u.pk || ''),
		username: u.username || null,
		name: u.fullName || u.full_name || u.username || null,
		fullName: u.fullName || u.full_name || null,
		profilePicUrl: u.profilePicUrl || u.profile_pic_url || null,
		isVerified: Boolean(u.isVerified || u.is_verified)
	};
}

async function getThreadInfoCached(client, threadID, force = false) {
	const id = String(threadID);
	if (!force && threadCache.has(id)) return threadCache.get(id);
	try {
		const conv = await client.getConversation(id);
		if (conv) {
			const info = {
				threadID: id,
				threadName: conv.title || null,
				isGroup: Boolean(conv.isGroup),
				participantIDs: (conv.participants || []).map((u) => String(u.id || u.pk)),
				adminIDs: (conv.adminUserIds || []).map(String),
				userInfo: (conv.participants || []).map(userToPlain),
				nicknames: conv.nicknames || {},
				memberCount: (conv.participants || []).length
			};
			threadCache.set(id, info);
			return info;
		}
	}
	catch { /* thread fetch can fail on weird threads, fall through */ }
	const fallback = { threadID: id, threadName: null, isGroup: false, participantIDs: [], adminIDs: [], userInfo: [], nicknames: {}, memberCount: 0 };
	threadCache.set(id, fallback);
	return fallback;
}

// fb-chat-api style facade over the ig client, this is what commands use
function buildApi(client) {
	const api = {
		rawClient: client,

		getCurrentUserID() {
			return client.session && client.session.userId ? String(client.session.userId) : (global.Anchestor.botID || null);
		},

		async sendMessage(threadID, body, callback, replyToMessageID) {
			try {
				let text = '';
				if (typeof body === 'string') text = body;
				else if (body && typeof body === 'object') text = body.body || body.text || '';
				let result;
				if (replyToMessageID) result = await client.reply(String(threadID), String(replyToMessageID), text);
				else result = await client.sendMessage(String(threadID), text);
				const sent = Array.isArray(result) ? result[0] : result;
				const info = {
					messageID: sent ? String(sent.id || sent.messageID || sent.item_id || '') : '',
					threadID: String(threadID),
					timestamp: Date.now()
				};
				if (typeof callback === 'function') callback(null, info);
				return info;
			}
			catch (err) {
				if (typeof callback === 'function') callback(err);
				throw err;
			}
		},

		// used by message.reply so replies stay threaded
		async replyMessage(threadID, messageID, text) {
			const result = await client.reply(String(threadID), String(messageID), text);
			const sent = Array.isArray(result) ? result[0] : result;
			return {
				messageID: sent ? String(sent.id || sent.messageID || sent.item_id || '') : '',
				threadID: String(threadID),
				timestamp: Date.now()
			};
		},

		async getThreadInfo(threadID) {
			return getThreadInfoCached(client, threadID);
		},

		async getUserInfo(idOrUsername) {
			// fb api returned a map, keep that shape: { [id]: { name, ... } }
			let user = null;
			if (/^\d+$/.test(String(idOrUsername))) user = await client.getUserById(String(idOrUsername));
			else user = await client.getUserByUsername(String(idOrUsername).replace(/^@/, ''));
			const plain = userToPlain(user);
			if (!plain) return {};
			return { [plain.id]: plain };
		},

		async setMessageReaction(emoji, messageID, threadID, callback) {
			try {
				const res = await client.sendReaction(String(threadID), String(messageID), emoji);
				if (typeof callback === 'function') callback(null, res);
				return res;
			}
			catch (err) {
				if (typeof callback === 'function') callback(err);
				throw err;
			}
		},

		async unsendMessage(messageID, threadID, callback) {
			try {
				const res = await client.unsendMessage(String(threadID), String(messageID));
				if (typeof callback === 'function') callback(null, res);
				return res;
			}
			catch (err) {
				if (typeof callback === 'function') callback(err);
				throw err;
			}
		},

		async changeNickname(nickname, threadID, userID) {
			if (!nickname) return client.clearNickname(String(threadID), String(userID));
			return client.setNickname(String(threadID), String(userID), nickname);
		},

		async changeThreadTitle(title, threadID) {
			return client.setThreadTitle(String(threadID), title);
		},

		async markAsRead(threadID) {
			try { return await client.markSeen(String(threadID)); }
			catch { return null; }
		},

		async markSeen(threadID, messageID) {
			if (messageID) return client.markSeen(String(threadID), String(messageID));
			return client.markSeen(String(threadID));
		},

		async editMessage(threadID, messageID, text, callback) {
			try {
				const res = await client.editMessage(String(threadID), String(messageID), text);
				if (typeof callback === 'function') callback(null, res);
				return res;
			}
			catch (err) {
				if (typeof callback === 'function') callback(err);
				throw err;
			}
		},

		async pinMessage(threadID, messageID) {
			return client.pinMessage(String(threadID), String(messageID));
		},

		async unpinMessage(threadID, messageID) {
			return client.unpinMessage(String(threadID), String(messageID));
		},

		async getPinnedMessages(threadID) {
			return client.getPinnedMessages(String(threadID));
		},

		async forwardMessage(fromThreadID, messageID, toThreadID) {
			return client.forwardMessage(String(fromThreadID), String(messageID), String(toThreadID));
		},

		async deleteReaction(threadID, messageID) {
			return client.deleteReaction(String(threadID), String(messageID));
		},

		async sendAudio(threadID, fileOrUrl) {
			return client.sendAudio(String(threadID), fileOrUrl);
		},

		async sendAudioFromUrl(threadID, url) {
			return client.sendAudioFromUrl(String(threadID), String(url));
		},

		async sendImage(threadID, fileOrUrl) {
			return client.sendImage(String(threadID), fileOrUrl);
		},

		async sendImageFromUrl(threadID, url) {
			return client.sendImageFromUrl(String(threadID), String(url));
		},

		async sendVideo(threadID, file) {
			return client.sendVideo(String(threadID), file);
		},

		async sendAttachment(threadID, attachment) {
			return client.sendAttachment(String(threadID), attachment);
		},

		async downloadMedia(url, destPath) {
			return client.downloadMedia(String(url), String(destPath));
		},

		async sharePost(threadID, mediaIdOrUrl) {
			return client.sharePost(String(threadID), mediaIdOrUrl);
		},

		async shareReel(threadID, mediaIdOrUrl) {
			return client.shareReel(String(threadID), mediaIdOrUrl);
		},

		async shareStory(threadID, storyMediaId) {
			return client.shareStory(String(threadID), storyMediaId);
		},

		async shareProfile(threadID, userIdOrUsername) {
			return client.shareProfile(String(threadID), userIdOrUsername);
		},

		async addParticipants(threadID, userIds) {
			return client.addParticipants(String(threadID), Array.isArray(userIds) ? userIds.map(String) : [String(userIds)]);
		},

		async removeParticipant(threadID, userIds) {
			return client.removeParticipant(String(threadID), Array.isArray(userIds) ? userIds.map(String) : [String(userIds)]);
		},

		async promoteAdmin(threadID, userIds) {
			return client.promoteAdmin(String(threadID), Array.isArray(userIds) ? userIds.map(String) : [String(userIds)]);
		},

		async demoteAdmin(threadID, userIds) {
			return client.demoteAdmin(String(threadID), Array.isArray(userIds) ? userIds.map(String) : [String(userIds)]);
		},

		async setThreadTitle(threadID, title) {
			return client.setThreadTitle(String(threadID), title);
		},

		async muteThread(threadID, muted = true) {
			return client.muteThread(String(threadID), muted);
		},

		async leaveThread(threadID) {
			return client.leaveThread(String(threadID));
		},

		async getPendingConversations(options = {}) {
			return client.getPendingConversations(options);
		},

		async acceptMessageRequest(threadID) {
			return client.acceptMessageRequest(String(threadID));
		},

		async declineMessageRequest(threadID) {
			return client.declineMessageRequest(String(threadID));
		},

		async getPendingFollowRequests(options = {}) {
			return client.getPendingFollowRequests(options);
		},

		async approveFollowRequest(userID) {
			return client.approveFollowRequest(String(userID));
		},

		async ignoreFollowRequest(userID) {
			return client.ignoreFollowRequest(String(userID));
		},

		async blockUser(userID) {
			return client.blockUser(String(userID));
		},

		async unblockUser(userID) {
			return client.unblockUser(String(userID));
		},

		async getFollowers(userID, options = {}) {
			return client.getFollowers(String(userID), options);
		},

		async getFollowing(userID, options = {}) {
			return client.getFollowing(String(userID), options);
		},

		async searchInThread(threadID, query, options = {}) {
			return client.searchInThread(String(threadID), query, options);
		},

		async findConversationByUsername(username) {
			return client.findConversationByUsername(String(username).replace(/^@/, ''));
		},

		async getNoteByUser(usernameOrId) {
			return client.getNoteByUser(usernameOrId);
		}
	};
	return api;
}

function normalizeMessage(msg) {
	const mentions = {};
	if (Array.isArray(msg.mentions)) for (const m of msg.mentions) mentions[m.userId] = m.username || '';
	const attachments = [];
	if (msg.media) attachments.push({ type: msg.media.type || 'media', url: msg.media.url || null, ...msg.media });
	if (msg.share) attachments.push({ type: `share_${msg.share.type || 'post'}`, ...msg.share });
	return {
		type: 'message',
		threadID: String(msg.threadId || ''),
		messageID: String(msg.id || msg.messageID || ''),
		senderID: String(msg.senderId || ''),
		senderName: msg.sender ? (msg.sender.fullName || msg.sender.username || null) : null,
		senderUsername: msg.sender ? (msg.sender.username || null) : null,
		body: msg.text || '',
		isGroup: false, // patched in dispatchWithThreadInfo
		participantIDs: [],
		mentions,
		attachments,
		messageReply: msg.replyTo ? {
			messageID: String(msg.replyTo.id || ''),
			senderID: String(msg.replyTo.senderId || ''),
			body: msg.replyTo.text || ''
		} : null,
		timestamp: msg.timestamp || Date.now(),
		isSelf: Boolean(msg.isSelf)
	};
}

async function start() {
	const config = global.Anchestor.config;
	const configIgApi = global.Anchestor.configIgApi || {};

	await loadData();

	const { InstaChatClient } = require('../../ig-chat-api');
	const client = new InstaChatClient(resolveSessionOptions(config, configIgApi));
	global.Anchestor.igApi = client;

	const api = buildApi(client);
	global.Anchestor.api = api;

	// Anchestor.js calls this on SIGINT/SIGTERM
	global.Anchestor.shutdown = async () => {
		try { await client.disconnect(); }
		catch { /* already gone */ }
	};

	const loadCounts = await loadScripts(api);

	async function dispatch(event) {
		try { await handlerEvents({ api, event }); }
		catch (err) { global.utils.log.error('HANDLER', err.stack || err.message); }
	}

	async function dispatchMessage(msg) {
		if (msg.isSelf && !configIgApi.selfListen) return;
		const event = normalizeMessage(msg);
		const info = await getThreadInfoCached(client, event.threadID);
		event.isGroup = info.isGroup;
		event.participantIDs = info.participantIDs;
		event.adminIDs = info.adminIDs;
		event.threadName = info.threadName;
		if (config.logEvents && config.logEvents.message)
			global.utils.log.dev('MESSAGE', `${event.senderUsername || event.senderID} in ${event.threadID}: ${event.body.slice(0, 80)}`);
		await dispatch(event);
	}

	client.on('message', (msg) => { dispatchMessage(msg).catch((e) => handlerWhenListenHasError(e)); });

	client.on('reaction', (rec) => {
		if (rec.isSelf && !configIgApi.selfListen) return;
		dispatch({
			type: 'message_reaction',
			threadID: String(rec.threadId || rec.threadID || ''),
			messageID: String(rec.messageId || rec.messageID || ''),
			senderID: String(rec.senderId || rec.userID || ''),
			userID: String(rec.senderId || rec.userID || ''),
			reaction: rec.emoji || rec.reaction || '',
			timestamp: rec.timestamp || Date.now()
		});
	});

	client.on('message_unsent', (unsent) => {
		dispatch({
			type: 'message_unsend',
			threadID: String(unsent.threadId || ''),
			messageID: String(unsent.messageId || unsent.messageID || ''),
			senderID: String(unsent.senderId || ''),
			timestamp: unsent.timestamp || Date.now()
		});
	});

	client.on('thread_update', (update) => {
		threadCache.delete(String(update.threadId || ''));
		const conv = update.conversation;
		dispatch({
			type: 'event',
			logMessageType: 'thread_update',
			threadID: String(update.threadId || ''),
			senderID: client.session && client.session.userId ? String(client.session.userId) : '',
			changes: update.changes || {},
			participantsAdded: update.participantsAdded || update.addedParticipants || [],
			participantsRemoved: update.participantsRemoved || update.removedParticipants || [],
			threadName: conv ? conv.title : null,
			isGroup: conv ? Boolean(conv.isGroup) : false,
			participantIDs: conv ? (conv.participants || []).map((u) => String(u.id || u.pk)) : [],
			timestamp: update.timestamp || Date.now()
		});
	});

	client.on('auth_error', (err) => handlerWhenListenHasError(err));
	client.on('rate_limit', (err) => handlerWhenListenHasError(err));
	client.on('error', (err) => handlerWhenListenHasError(err));

	await client.connect();
	global.Anchestor.botID = client.session && client.session.userId ? String(client.session.userId) : null;
	global.utils.log.success('LOGIN', global.utils.getText('Anchestor', 'loginSuccess', client.username || 'unknown', global.Anchestor.botID || '?'));
	global.utils.log.success('READY',
		`anchestor is online — ${loadCounts.commands} commands, ${loadCounts.events} events` +
		` (${loadCounts.shadowed} shadowed, ${loadCounts.dormant} dormant), prefix "${config.prefix}",` +
		` database ${((config.database || {}).type || 'json')}, session ${client.session && client.session.sessionPath ? client.session.sessionPath : 'data/session.json'}`);
	return { client, api };
}

// Anchestor.js just requires this file
if (require.main !== module && !global.__anchestorLoginManual) {
	start().catch((err) => {
		handlerWhenListenHasError(err);
		if (global.utils) global.utils.log.error('LOGIN', `failed to login: ${err.message}. check data/session.json (see data/session.json.example)`);
	});
}

module.exports = start;
module.exports.start = start;
module.exports.buildApi = buildApi;
module.exports.normalizeMessage = normalizeMessage;
module.exports.resolveSessionOptions = resolveSessionOptions;
