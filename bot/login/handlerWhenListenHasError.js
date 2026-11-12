'use strict';

// central place for listen/client errors so login.js stays readable.
// the same auth failure surfaces twice (the client's auth_error event and
// start()'s catch), so identical lines inside 5s are printed once.
let lastLine = '';
let lastAt = 0;

function once(log, level, line) {
	const now = Date.now();
	if (line === lastLine && now - lastAt < 5000) return;
	lastLine = line;
	lastAt = now;
	log[level]('LISTEN', line);
}

module.exports = function handlerWhenListenHasError(err) {
	if (!err) return;
	const log = global.utils ? global.utils.log : console;
	const msg = err.message || String(err);
	if (err.code === 'CHECKPOINT_REQUIRED' || /checkpoint|verification/i.test(msg)) {
		once(log, 'error', 'instagram wants a security check on this account — open instagram.com in your browser while logged in, complete the verification, then re-export fresh cookies into account.txt');
		return;
	}
	if (err.code === 'PROMPT_REQUIRED' || /4415001|prompt has contribution/i.test(msg)) {
		once(log, 'error', 'instagram is holding this account behind a popup (Accounts Center / cross-app sharing / business tools) — open instagram.com in your browser, accept or dismiss the popup, then restart the bot. no new cookies needed');
		return;
	}
	if (err.code === 'SESSION_EXPIRED' || /session/i.test(msg) && /expired|invalid|terminated/i.test(msg)) {
		const status = err.status ? ` (HTTP ${err.status})` : '';
		once(log, 'error', `instagram session expired${status}. grab fresh sessionid/csrftoken cookies and update account.txt`);
		return;
	}
	if (err.code === 'RATE_LIMIT' || /rate.?limit|429/i.test(msg)) {
		once(log, 'warn', `rate limited by instagram, slowing down: ${msg}`);
		return;
	}
	once(log, 'error', msg);
};
