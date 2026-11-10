'use strict';

const log = require('./logger/log');
const loading = require('./logger/loading');
const { getText } = require('./languages/makeFuncGetLangs');

function getPrefix(threadID) {
	try {
		const threadsData = require('./database/controller/threadsData');
		const rec = threadsData.peek(threadID);
		if (rec && rec.data && rec.data.prefix) return rec.data.prefix;
	}
	catch { /* cache not ready yet */ }
	// fall back to the in-memory cache if the controller isn't loaded
	try {
		const all = (global.db && global.db.allThreadData) || [];
		const found = all.find((t) => String(t.threadID) === String(threadID));
		if (found && found.data && found.data.prefix) return found.data.prefix;
	}
	catch { /* ignore */ }
	// a prefix set at runtime with -prefix <p> -g lives in globalData
	try {
		const globalData = require('./database/controller/globalData');
		const stored = globalData.peek('prefix');
		if (stored) return stored;
	}
	catch { /* ignore */ }
	return (global.Anchestor && global.Anchestor.config && global.Anchestor.config.prefix) || '-';
}

async function getGlobalPrefix() {
	try {
		const globalData = require('./database/controller/globalData');
		const stored = await globalData.get('prefix');
		if (stored) return stored;
	}
	catch { /* ignore */ }
	return (global.Anchestor && global.Anchestor.config && global.Anchestor.config.prefix) || '-';
}

function convertTime(ms) {
	ms = Number(ms) || 0;
	const sec = Math.floor(ms / 1000);
	const d = Math.floor(sec / 86400);
	const h = Math.floor((sec % 86400) / 3600);
	const m = Math.floor((sec % 3600) / 60);
	const s = sec % 60;
	const parts = [];
	if (d) parts.push(`${d}d`);
	if (h) parts.push(`${h}h`);
	if (m) parts.push(`${m}m`);
	parts.push(`${s}s`);
	return parts.join(' ');
}

function getTime(formatted = true) {
	const tz = (global.Anchestor && global.Anchestor.config && global.Anchestor.config.timeZone) || 'Asia/Dhaka';
	try {
		return new Intl.DateTimeFormat('en-GB', {
			timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
			hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
		}).format(new Date());
	}
	catch {
		return formatted ? new Date().toLocaleString('en-GB') : Date.now();
	}
}

function isNumber(value) {
	return !Number.isNaN(Number(value)) && String(value).trim() !== '';
}

function removeHomeDir(text) {
	const home = process.env.HOME || '';
	return String(text || '').split(home).join('~');
}

function delay(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function splitOnce(text, sep) {
	const idx = String(text).indexOf(sep);
	if (idx === -1) return [String(text), ''];
	return [String(text).slice(0, idx), String(text).slice(idx + sep.length)];
}

module.exports = {
	log,
	loading,
	getText,
	getPrefix,
	getGlobalPrefix,
	convertTime,
	getTime,
	isNumber,
	removeHomeDir,
	delay,
	splitOnce
};
