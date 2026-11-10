module.exports = {
	config: {
		name: "react",
		aliases: ["reaction"],
		version: "1.0.0",
		author: "xemonbae01",
		countDown: 2,
		role: 0,
		description: { en: "react to the message you replied to" },
		category: "utility",
		guide: { en: "   reply to a message + {pn} [emoji]" +
			"\n   reply to a message + {pn} off: remove my reaction" }
	},

	onStart: async function ({ message, event, args, api }) {
		if (!event.messageReply || !event.messageReply.messageID)
			return message.reply("reply to a message and use -react <emoji>");
		const target = event.messageReply.messageID;
		const client = api.rawClient;
		try {
			if ((args[0] || "").toLowerCase() === "off") {
				if (api.deleteReaction) await api.deleteReaction(event.threadID, target);
				else await client.deleteReaction(event.threadID, target);
				return message.send("reaction removed");
			}
			const emoji = args[0] || "❤️";
			if (api.setMessageReaction) await api.setMessageReaction(emoji, target, event.threadID);
			else await client.sendReaction(event.threadID, target, emoji);
			return null;
		}
		catch (err) {
			return message.reply(`react failed: ${err.message}`);
		}
	}
};
