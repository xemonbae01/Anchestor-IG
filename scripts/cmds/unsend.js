module.exports = {
	config: {
		name: "unsend",
		aliases: ["u"],
		version: "1.0.0",
		author: "xemonbae01",
		countDown: 2,
		role: 0,
		description: { en: "unsend the bot message you replied to" },
		category: "utility",
		guide: { en: "   reply to a bot message + {pn}" }
	},

	onStart: async function ({ message, event, api }) {
		if (!event.messageReply || !event.messageReply.messageID)
			return message.reply("reply to one of my messages and use -unsend");
		const botID = String(api.getCurrentUserID() || global.Anchestor.botID || "");
		if (event.messageReply.senderID && String(event.messageReply.senderID) !== botID)
			return message.reply("i can only unsend my own messages");
		try {
			await api.unsendMessage(event.messageReply.messageID, event.threadID);
			return message.send("unsent 🗑️");
		}
		catch (err) {
			return message.reply(`failed to unsend: ${err.message}`);
		}
	}
};
