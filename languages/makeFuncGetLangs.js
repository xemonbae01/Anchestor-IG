'use strict';

const fs = require('fs');
const path = require('path');

const cache = {};

function parseLangFile(lang) {
	if (cache[lang]) return cache[lang];
	const file = path.join(__dirname, `${lang}.lang`);
	const data = {};
	if (fs.existsSync(file)) {
		let head = null;
		for (const rawLine of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
			const line = rawLine.trim();
			if (!line || line.startsWith('#') || line.startsWith('//')) continue;
			const section = line.match(/^\[(.+)\]$/);
			if (section) {
				head = section[1].trim();
				data[head] = data[head] || {};
				continue;
			}
			const idx = line.indexOf('=');
			if (idx > 0 && head) {
				const key = line.slice(0, idx).trim();
				data[head][key] = line.slice(idx + 1).trim().replace(/\\n/g, '\n');
			}
		}
	}
	cache[lang] = data;
	return data;
}

function getText(...params) {
	let lang = (global.Anchestor && global.Anchestor.config && global.Anchestor.config.language) || 'en';
	let head, key, args;
	// getText({ lang, head }, key, ...args) or getText(head, key, ...args)
	if (params[0] && typeof params[0] === 'object') {
		lang = params[0].lang || lang;
		head = params[0].head;
		key = params[1];
		args = params.slice(2);
	}
	else {
		head = params[0];
		key = params[1];
		args = params.slice(2);
	}
	try {
		let text = parseLangFile(lang)?.[head]?.[key];
		if (text === undefined && lang !== 'en') text = parseLangFile('en')?.[head]?.[key];
		if (text === undefined) return `${head}.${key}`;
		args.forEach((arg, i) => {
			text = text.replace(new RegExp(`%${i + 1}`, 'g'), String(arg));
		});
		return text;
	}
	catch {
		return `${head}.${key}`;
	}
}

module.exports = { getText, parseLangFile };
