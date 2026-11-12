'use strict';

const fs = require('fs');
const path = require('path');

// tiny .env loader, no dependency. fills process.env from the repo root
// .env file so MONGODB_URI and friends work from a plain file. only sets
// vars that aren't already set — real env always wins.
function loadEnv(rootDir = __dirname) {
	const envPath = path.join(rootDir, '.env');
	if (!fs.existsSync(envPath)) return false;
	for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;
		const eq = trimmed.indexOf('=');
		if (eq <= 0) continue;
		const key = trimmed.slice(0, eq).trim();
		let value = trimmed.slice(eq + 1).trim();
		if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
			value = value.slice(1, -1);
		if (key && !(key in process.env)) process.env[key] = value;
	}
	return true;
}

module.exports = loadEnv;
