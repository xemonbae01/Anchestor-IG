'use strict';

// session file parsing — account.txt (or data/session.json) can hold the
// cookies in whatever shape the browser export gave you, we figure it out.
// accepted formats:
//   - Cookie-Editor / EditThisCookie json array: [{ "name": "sessionid", "value": "..." }, ...]
//   - { "cookies": { "sessionid": "...", ... } }  (also { "cookies": [array] })
//   - flat object: { "sessionid": "...", "csrftoken": "...", "ds_user_id": "..." }
//   - the shape Session.save() writes: { "userId", "username", "cookies", "cookieString", ... }
//   - Netscape HTTP Cookie File text (Cookie-Editor "Netscape" export)
//   - raw cookie string: "sessionid=...; csrftoken=...; ds_user_id=..."
// only sessionid + ds_user_id are strictly required; csrftoken is expected
// too (the ig client throws without it) but we don't hard-fail here so the
// error from the client names the missing cookie instead.

const fs = require('fs');
const path = require('path');

const REQUIRED = ['sessionid', 'ds_user_id'];
// keys in a flat object that are metadata, not cookies
const RESERVED = new Set(['userId', 'username', 'createdAt', 'expiresAt', 'cookieString', 'cookies']);

function cookiesFromNameValueList(list) {
	const cookies = {};
	for (const item of list) {
		if (item && typeof item.name === 'string' && item.value !== undefined && item.value !== null)
			cookies[item.name] = String(item.value);
	}
	return cookies;
}

function fromParsedJson(data) {
	let cookies = {};
	let userId = null;
	if (Array.isArray(data)) {
		cookies = cookiesFromNameValueList(data);
	} else if (data && typeof data === 'object') {
		if (data.cookies && typeof data.cookies === 'object') {
			cookies = Array.isArray(data.cookies)
				? cookiesFromNameValueList(data.cookies)
				: { ...data.cookies };
		} else if (typeof data.cookieString === 'string') {
			cookies = parseCookieString(data.cookieString);
		} else {
			// flat object, keep every string value except the metadata keys
			for (const [key, value] of Object.entries(data)) {
				if (!RESERVED.has(key) && value !== undefined && value !== null)
					cookies[key] = String(value);
			}
		}
		userId = data.userId ? String(data.userId) : null;
	}
	return finish(cookies, userId);
}

function parseCookieString(str) {
	const cookies = {};
	for (const pair of String(str).split(';')) {
		const idx = pair.indexOf('=');
		if (idx === -1) continue;
		const key = pair.slice(0, idx).trim();
		const value = pair.slice(idx + 1).trim();
		if (key) cookies[key] = value;
	}
	return cookies;
}

// Netscape format: one cookie per line, tab separated
// domain, flag, path, secure, expiry, name, value
// "#HttpOnly_" lines are data too (the prefix sits on the domain), real
// comments start with "#" and have no tabs.
function fromNetscape(text) {
	const cookies = {};
	for (const line of String(text).split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		if (trimmed.startsWith('#') && !trimmed.startsWith('#HttpOnly_')) continue;
		const cols = trimmed.split('\t').length >= 7
			? trimmed.split('\t')
			: trimmed.split(/\s+/);
		if (cols.length < 7) continue;
		const name = cols[5].trim();
		const value = cols[6].trim();
		if (name) cookies[name] = value;
	}
	return finish(cookies, null);
}

function finish(cookies, userId) {
	const missing = REQUIRED.filter((name) => !cookies[name]);
	if (missing.length > 0)
		throw new Error(`session is missing required cookie(s): ${missing.join(', ')}`);
	return {
		cookies,
		userId: userId || String(cookies.ds_user_id)
	};
}

function parseSessionText(text) {
	if (text === undefined || text === null) return null;
	const raw = String(text).trim();
	if (!raw) return null;
	if (raw.startsWith('[') || raw.startsWith('{')) {
		let data;
		try {
			data = JSON.parse(raw);
		}
		catch (err) {
			throw new Error(`not valid JSON (${err.message})`);
		}
		return fromParsedJson(data);
	}
	// Netscape files have tabs or #HttpOnly_ lines, cookie strings have ';'
	if (raw.includes('\t') || raw.startsWith('#'))
		return fromNetscape(raw);
	return finish(parseCookieString(raw), null);
}

// returns null when the file doesn't exist, throws on bad content
function loadSessionFile(filePath) {
	if (!fs.existsSync(filePath)) return null;
	let parsed;
	try {
		parsed = parseSessionText(fs.readFileSync(filePath, 'utf8'));
	}
	catch (err) {
		throw new Error(`${path.basename(filePath)}: ${err.message}`);
	}
	if (!parsed)
		throw new Error(`${path.basename(filePath)} is empty — paste your cookies in there (see README)`);
	return parsed;
}

// what shape is the session file in? the bot parses the cookies itself and
// hands them to the ig client as an object, so the client never sees the
// file — this tells it the original format so a save-back keeps it. returns
// null for Netscape text / raw cookie strings (no json shape to keep).
function detectFileFormat(filePath) {
	try {
		const raw = fs.readFileSync(filePath, 'utf8').trim();
		if (!raw) return null;
		let data;
		try { data = JSON.parse(raw); }
		catch { return null; }
		if (Array.isArray(data))
			return { format: 'array', items: data.filter((i) => i && typeof i.name === 'string').map((i) => ({ ...i })) };
		if (data && typeof data === 'object') {
			if (Array.isArray(data.cookies))
				return { format: 'array', items: data.cookies.filter((i) => i && typeof i.name === 'string').map((i) => ({ ...i })) };
			if (data.cookies && typeof data.cookies === 'object')
				return { format: ('cookieString' in data || 'createdAt' in data) ? 'session' : 'cookies', items: null };
			if (data.sessionid)
				return { format: 'flat', items: null };
		}
		return null;
	}
	catch { return null; }
}

// canonical shape we write back: { "cookies": {...}, "userId": "..." }
// (Session.save() writes a superset of this, which also parses fine)
function formatSessionJson(cookies, userId) {
	const out = { cookies: { ...cookies } };
	if (userId) out.userId = String(userId);
	return out;
}

module.exports = {
	parseSessionText,
	loadSessionFile,
	formatSessionJson,
	parseCookieString,
	detectFileFormat
};
