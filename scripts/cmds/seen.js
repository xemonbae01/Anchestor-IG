module.exports = {
	config: {
		name: "seen",
		version: "1.0.0",
		author: "xemonbae01",
		countDown: 2,
		role: 0,
		description: { en: "mark the replied message as seen" },
		category: "utility",
		guide: { en: "   reply to a message + {pn}" }
	},

	onStart: async function ({ message, event, api }) {
		if (!event.messageReply || !event.messageReply.messageID)
			return message.reply("reply to a message and use -seen");
		const client = api.rawClient;
		try {
			if (api.markSeen) await api.markSeen(event.threadID, event.messageReply.messageID);
			else await client.markSeen(event.threadID, event.messageReply.messageID);
			return null; // seen receipts don't need a message back
		}
		catch (err) {
			return message.reply(`seen failed: ${err.message}`);
		}
	}
};
