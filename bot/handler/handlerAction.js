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
			return toCallback(promise, callback);
		},

		send(body, callback) {
			const payload = normalize(body);
			const text = payload.body !== undefined ? payload.body : payload.text;
			return toCallback(api.sendMessage(threadID, text), callback);
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
