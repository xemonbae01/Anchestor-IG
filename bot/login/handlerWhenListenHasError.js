'use strict';

// central place for listen/client errors so login.js stays readable
module.exports = function handlerWhenListenHasError(err) {
	if (!err) return;
	const log = global.utils ? global.utils.log : console;
	const msg = err.message || String(err);
	if (err.code === 'SESSION_EXPIRED' || /session/i.test(msg) && /expired|invalid|terminated/i.test(msg)) {
		log.error('LISTEN', 'instagram session expired. grab fresh sessionid/csrftoken cookies and update data/session.json');
		return;
	}
	if (err.code === 'RATE_LIMIT' || /rate.?limit|429/i.test(msg)) {
		log.warn('LISTEN', `rate limited by instagram, slowing down: ${msg}`);
		return;
	}
	log.error('LISTEN', msg);
};
