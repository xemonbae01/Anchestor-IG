'use strict';

// onReply entries + reply sessions live here.
// wraps global.Anchestor.onReply (keyed by the bot message id) and
// global.Anchestor.onReplySession (keyed by thread:user, next message wins)
const DEFAULT_TTL = 5 * 60 * 1000;

let currentDispatch = null; // { key, name } of the module being dispatched now
let sweeper = null;

function maps() {
	const A = global.Anchestor;
	if (!A.onReply) A.onReply = new Map();
	if (!A.onReplySession) A.onReplySession = new Map();
	return A;
}

function mapFor(kind) {
	const A = maps();
	return kind === 'session' ? A.onReplySession : A.onReply;
}

function keyOf(entry, kind) {
	return kind === 'session' ? `${entry.threadID}:${entry.author}` : entry.messageID;
}

// the handler stamps every hook call with the module being dispatched, so an
// entry set from inside a command knows which module owns it (matters when
// the module is shadowed and only reachable through an alias). the stamp only
// applies when the entry's commandName matches the module on the floor —
// entries set from anywhere else resolve by commandName like before
function setCurrentKey(key, name) {
	currentDispatch = key ? { key, name: name || null } : null;
}

function normalizeEntry(raw, messageID) {
	const now = Date.now();
	const entry = { ...(raw || {}) };
	entry.messageID = messageID ? String(messageID) : (entry.messageID ? String(entry.messageID) : null);
	entry.commandName = entry.commandName || null;
	entry.threadID = entry.threadID != null ? String(entry.threadID) : null;
	if (entry.author == null && entry.senderID != null) entry.author = entry.senderID;
	entry.author = entry.author != null ? String(entry.author) : null;
	entry.createdAt = entry.createdAt || now;
	entry.ttlMs = Number(entry.ttlMs) || DEFAULT_TTL;
	entry.expiresAt = entry.expiresAt || (entry.createdAt + entry.ttlMs);
	entry.allowAnyone = Boolean(entry.allowAnyone);
	if (entry.data == null) {
		// older entries carried their state as top level fields (tracks, items...)
		const rest = { ...entry };
		for (const k of ['commandName', 'messageID', 'threadID', 'senderID', 'author', 'createdAt', 'expiresAt', 'ttlMs', 'allowAnyone', 'data', '__key', '__kept'])
			delete rest[k];
		entry.data = rest;
	}
	if (currentDispatch && currentDispatch.name === entry.commandName && !entry.__key)
		entry.__key = currentDispatch.key;
	entry.__kept = false;
	return entry;
}

function setEntry(messageID, raw) {
	const entry = normalizeEntry(raw, messageID);
	maps().onReply.set(entry.messageID, entry);
	return entry;
}

// expiry aware lookup, expired entries get deleted and look like nothing
function getEntry(messageID) {
	const map = maps().onReply;
	const raw = map.get(String(messageID));
	if (!raw) return null;
	const entry = raw.expiresAt ? raw : normalizeEntry(raw, messageID);
	if (entry.expiresAt <= Date.now()) {
		map.delete(entry.messageID);
		return null;
	}
	if (entry !== raw) map.set(entry.messageID, entry);
	return entry;
}

function setSession({ commandName, threadID, author, ttlMs, data, __key }) {
	const entry = normalizeEntry({
		commandName,
		threadID,
		author,
		ttlMs,
		data: data || {},
		__key
	}, null);
	maps().onReplySession.set(keyOf(entry, 'session'), entry);
	return entry;
}

function getSession(threadID, author) {
	const map = maps().onReplySession;
	const key = `${threadID}:${author}`;
	const entry = map.get(key);
	if (!entry) return null;
	if (entry.expiresAt && entry.expiresAt <= Date.now()) {
		map.delete(key);
		return null;
	}
	return entry;
}

// helpers handed to onReply as ctx.Reply
function helpersFor(entry, kind = 'reply') {
	return {
		entry,
		// stay alive for the next reply, fresh ttl, optional state merge
		keep(newData) {
			if (newData && typeof newData === 'object')
				entry.data = { ...(entry.data || {}), ...newData };
			entry.expiresAt = Date.now() + (entry.ttlMs || DEFAULT_TTL);
			entry.__kept = true;
			mapFor(kind).set(keyOf(entry, kind), entry);
		},
		end() {
			entry.__kept = true;
			mapFor(kind).delete(keyOf(entry, kind));
		}
	};
}

// after a handled onReply: consumed unless keep() was called or the entry
// was re-set with a new object while the handler ran
function afterCall(entry, kind = 'reply') {
	const map = mapFor(kind);
	if (map.get(keyOf(entry, kind)) === entry && !entry.__kept)
		map.delete(keyOf(entry, kind));
}

function sweep() {
	const now = Date.now();
	for (const [key, entry] of [...maps().onReply.entries()])
		if (entry && entry.expiresAt && entry.expiresAt <= now) maps().onReply.delete(key);
	for (const [key, entry] of [...maps().onReplySession.entries()])
		if (entry && entry.expiresAt && entry.expiresAt <= now) maps().onReplySession.delete(key);
}

function startSweeper(intervalMs = 60 * 1000) {
	if (sweeper) return sweeper;
	sweeper = setInterval(sweep, intervalMs);
	if (sweeper.unref) sweeper.unref();
	return sweeper;
}

module.exports = {
	DEFAULT_TTL,
	setCurrentKey,
	setEntry,
	getEntry,
	setSession,
	setReplySession: setSession,
	getSession,
	helpersFor,
	afterCall,
	sweep,
	startSweeper,
	normalizeEntry
};
