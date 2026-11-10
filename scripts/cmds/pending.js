module.exports = {
	config: {
		name: "pending",
		aliases: ["requests"],
		version: "1.0.0",
		author: "xemonbae01",
		countDown: 5,
		role: 2,
		description: { en: "message requests waiting in the pending inbox" },
		category: "admin",
		guide: { en: "   {pn}: list pending threads" +
			"\n   then reply to the list with a number to accept it, or \"no <number>\" to decline" }
	},

	onStart: async function ({ message, event, api }) {
		const client = api.rawClient;
		try {
			const res = api.getPendingConversations
				? await api.getPendingConversations({ limit: 20 })
				: await client.getPendingConversations({ limit: 20 });
			const list = Array.isArray(res) ? res : (res.conversations || res.threads || []);
			if (!list.length) return message.reply("no pending message requests");
			const lines = list.slice(0, 20).map((c, i) => {
				const who = (c.participants || []).map((p) => `@${p.username || p.fullName || p.id}`).join(", ") || "?";
				const last = c.lastMessage ? (c.lastMessage.text || "(media)") : "";
				return `${i + 1}. ${c.title || who}\n   ${who}${last ? `\n   last: ${String(last).slice(0, 60)}` : ""}`;
			});
			const info = await message.reply("pending message requests:\n" + lines.join("\n") +
				"\nreply with a number to accept, or \"no <number>\" to decline");
			if (info && info.messageID) {
				global.Anchestor.onReply.set(info.messageID, {
					commandName: "pending",
					messageID: info.messageID,
					threadID: event.threadID,
					senderID: event.senderID,
					items: list.slice(0, 20).map((c) => String(c.id || c.threadId))
				});
			}
			return info;
		}
		catch (err) {
			return message.reply(`failed to load pending requests: ${err.message}`);
		}
	},

	onReply: async function ({ message, event, api, onReply }) {
		const items = (onReply && onReply.items) || [];
		const body = (event.body || "").trim().toLowerCase();
		const decline = /^no\s+(\d+)$/.exec(body);
		const accept = /^(\d+)$/.exec(body);
		const num = decline ? Number(decline[1]) : accept ? Number(accept[1]) : null;
		if (!num || num < 1 || num > items.length) {
			await message.reply("reply with a number from the list (or \"no <number>\" to decline)");
			return true;
		}
		const target = items[num - 1];
		const client = api.rawClient;
		try {
			if (decline) {
				if (api.declineMessageRequest) await api.declineMessageRequest(target);
				else await client.declineMessageRequest(target);
				await message.reply(`declined request ${num}`);
			}
			else {
				if (api.acceptMessageRequest) await api.acceptMessageRequest(target);
				else await client.acceptMessageRequest(target);
				await message.reply(`accepted request ${num}, thread ${target} is in the inbox now`);
			}
		}
		catch (err) {
			await message.reply(`failed: ${err.message}`);
		}
		return true;
	}
};
