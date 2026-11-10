module.exports = {
	config: {
		name: "nickname",
		aliases: ["nick"],
		version: "1.0.0",
		author: "xemonbae01",
		countDown: 3,
		role: 0,
		description: { en: "set or clear a nickname in this thread" },
		category: "group",
		guide: { en: "   {pn} <nickname>: set your nickname" +
			"\n   reply to someone + {pn} <nickname>: set theirs" +
			"\n   {pn} clear: remove your nickname" }
	},

	onStart: async function ({ message, event, args, api }) {
		const target = (event.messageReply && event.messageReply.senderID) || event.senderID;
		try {
			if (!args.length || args[0].toLowerCase() === "clear") {
				await api.changeNickname(null, event.threadID, target);
				return message.reply("nickname cleared");
			}
			const nick = args.join(" ");
			await api.changeNickname(nick, event.threadID, target);
			return message.reply(`nickname set to "${nick}"`);
		}
		catch (err) {
			return message.reply(`failed: ${err.message}`);
		}
	}
};
