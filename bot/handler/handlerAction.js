'use strict';

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
		global.temp.lastBotMessage[threadID] = { messageID: info.messageID, body: text || '', timestamp: Date.now() };
		global.temp.botMessages = global.temp.botMessages || {};
		const ring = global.temp.botMessages[threadID] || (global.temp.botMessages[threadID] = []);
		ring.push({ messageID: info.messageID, body: text || '', timestamp: Date.now() });
		if (ring.length > 10) ring.shift();
	}

	const message = {
		threadID,
		messageID: event.messageID || null,
		_guideText: null,
		_commandName: null,

		reply(body, callback) {
			const payload = normalize(body);
			const text = payload.body !== undefined ? payload.body : payload.text;
			const promise = (async () => {
				if (event.messageID && api.replyMessage)
					return api.replyMessage(threadID, event.messageID, text);
				return api.sendMessage(threadID, text);
			})();
			promise.then((info) => track(info, text)).catch(() => {});
			return toCallback(promise, callback);
		},

		send(body, callback) {
			const payload = normalize(body);
			const text = payload.body !== undefined ? payload.body : payload.text;
			const promise = Promise.resolve().then(() => api.sendMessage(threadID, text));
			promise.then((info) => track(info, text)).catch(() => {});
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

module.exports = { createMessage };
