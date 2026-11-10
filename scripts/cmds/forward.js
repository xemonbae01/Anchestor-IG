module.exports = {
	config: {
		name: "forward",
		aliases: ["fwd"],
		version: "1.0.0",
		author: "xemonbae01",
		countDown: 5,
		role: 0,
		description: { en: "forward the replied message to another thread or user" },
		category: "utility",
		guide: { en: "   reply to a message + {pn} <thread id>" +
			"\n   reply to a message + {pn} @username" }
	},

	onStart: async function ({ message, event, args, api }) {
		if (!event.messageReply || !event.messageReply.messageID)
			return message.reply("reply to a message and use -forward <thread id or @username>");
		if (!args[0]) return message.SyntaxError();
		const client = api.rawClient;
		try {
			let targetThread = args[0];
			if (targetThread.startsWith("@") || !/^\d+$/.test(targetThread)) {
				const conv = api.findConversationByUsername
					? await api.findConversationByUsername(targetThread)
					: await client.findConversationByUsername(targetThread.replace(/^@/, ""));
				if (!conv) return message.reply(`no dm thread found with ${args[0]}`);
				targetThread = String(conv.id || conv.threadId);
			}
			if (api.forwardMessage) await api.forwardMessage(event.threadID, event.messageReply.messageID, targetThread);
			else await client.forwardMessage(event.threadID, event.messageReply.messageID, targetThread);
			return message.send(`forwarded to ${targetThread} ↪️`);
		}
		catch (err) {
			return message.reply(`forward failed: ${err.message}`);
		}
	}
};
