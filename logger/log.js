'use strict';

const colors = require('./logColor');

function timeNow() {
	try {
		const tz = (global.Anchestor && global.Anchestor.config && global.Anchestor.config.timeZone) || 'Asia/Dhaka';
		return new Intl.DateTimeFormat('en-GB', {
			timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
		}).format(new Date());
	}
	catch {
		return new Date().toLocaleTimeString('en-GB');
	}
}

function make(level, colorFn, label) {
	return function (tag, message) {
		if (message === undefined) {
			message = tag;
			tag = level.toUpperCase();
		}
		if (typeof message !== 'string') {
			try { message = JSON.stringify(message); }
			catch { message = String(message); }
		}
		console.log(`${colors.gray(timeNow())} ${colorFn(label)} ${colors.bold(String(tag))} » ${message}`);
	};
}

module.exports = {
	error: make('error', colors.red, '✖'),
	warn: make('warn', colors.yellow, '⚠'),
	info: make('info', colors.cyan, 'ℹ'),
	success: make('success', colors.green, '✔'),
	master: make('master', colors.magenta, '★'),
	dev: make('dev', colors.gray, '›'),
	colors
};
