'use strict';

// ig starts choking on very long texts, split around this size
const CHUNK_LIMIT = 900;

// split on line boundaries where possible, hard cut only for monster lines
function splitText(text) {
	const str = String(text ?? '');
	if (str.length <= CHUNK_LIMIT) return [str];
	const chunks = [];
	let current = '';
	const push = () => { if (current) { chunks.push(current); current = ''; } };
	for (const line of str.split('\n')) {
		if (line.length > CHUNK_LIMIT) {
			push();
			for (let i = 0; i < line.length; i += CHUNK_LIMIT) chunks.push(line.slice(i, i + CHUNK_LIMIT));
			continue;
		}
		const candidate = current ? `${current}\n${line}` : line;
		if (candidate.length > CHUNK_LIMIT) {
			push();
			current = line;
		}
		else current = candidate;
	}
	push();
	return chunks.length ? chunks : [str];
}

// builds the `message` object commands talk to
function createMessage(api, event) {
	const threadID = event.threadID;

	function normalize(body) {
		if (typeof body === 'string') return { body };
		return body || {};
	}

	function toCallback(promise, callback) {
		if (typeof callback === 'function') {
			promise.then(
				(info) => callback(null, info),
				(err) => callback(err)
			);
		}
		return promise;
	}

	// remember what the bot sent, -edit and friends need it later
	function track(info, text) {
		if (!info || !info.messageID) return;
		if (!global.temp) global.temp = {};
		global.temp.lastBotMessage = global.temp.lastBotMessage || {};
		const entry = {
			messageID: info.messageID,
			body: text || '',
			timestamp: Date.now(),
			commandName: message._commandName || null
		};
		global.temp.lastBotMessage[threadID] = entry;
		global.temp.botMessages = global.temp.botMessages || {};
		const ring = global.temp.botMessages[threadID] || (global.temp.botMessages[threadID] = []);
		ring.push(entry);
		if (ring.length > 10) ring.shift();
	}

	// sends text in chunks, resolves with the info of the LAST chunk so
	// onReply registration on the returned messageID keeps working
	async function sendChunked(text, threaded) {
		const chunks = splitText(text);
		let lastInfo = null;
		for (let i = 0; i < chunks.length; i++) {
			let info;
			if (i === 0 && threaded && event.messageID && api.replyMessage)
				info = await api.replyMessage(threadID, event.messageID, chunks[i]);
			else
				info = await api.sendMessage(threadID, chunks[i]);
			if (info) lastInfo = info;
			track(info, chunks[i]);
		}
		return lastInfo;
	}

	const message = {
		threadID,
		messageID: event.messageID || null,
		_guideText: null,
		_commandName: null,

		reply(body, callback) {
			const payload = normalize(body);
			const text = payload.body !== undefined ? payload.body : payload.text;
			const promise = sendChunked(text, true);
			return toCallback(promise, callback);
		},

		send(body, callback) {
			const payload = normalize(body);
			const text = payload.body !== undefined ? payload.body : payload.text;
			const promise = sendChunked(text, false);
			return toCallback(promise, callback);
		},

		reaction(emoji, messageID) {
			const target = messageID || event.messageID;
			if (!target) return Promise.resolve(null);
			if (api.setMessageReaction) return api.setMessageReaction(emoji, target, threadID);
			return Promise.resolve(null);
		},

		unsend(messageID) {
			const target = messageID || event.messageID;
			if (!target) return Promise.resolve(null);
			if (api.unsendMessage) return api.unsendMessage(target, threadID);
			return Promise.resolve(null);
		},

		// edit one of the bot's own messages, defaults to the last one sent here
		async edit(text, messageID) {
			let target = messageID || null;
			if (!target && global.temp && global.temp.lastBotMessage)
				target = (global.temp.lastBotMessage[threadID] || {}).messageID || null;
			if (!target) throw new Error('no bot message to edit in this thread');
			if (api.editMessage) return api.editMessage(threadID, target, text);
			if (api.rawClient) return api.rawClient.editMessage(threadID, target, text);
			throw new Error('edit is not available');
		},

		async SyntaxError() {
			// guide text gets filled in by handlerEvents once the command is known
			const guide = message._guideText;
			const prefix = global.utils.getPrefix(threadID);
			let text = 'Wrong syntax.';
			if (guide) {
				text = global.utils.getText('handlerEvents', 'syntaxError',
					String(guide).split('{pn}').join(`${prefix}${message._commandName || ''}`));
			}
			return message.reply(text);
		}
	};

	return message;
}

module.exports = { createMessage, splitText };
