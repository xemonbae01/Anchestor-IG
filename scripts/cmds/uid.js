module.exports = {
	config: {
		name: "uid",
		aliases: ["id"],
		version: "1.0.0",
		author: "xemonbae01",
		countDown: 2,
		role: 0,
		description: { en: "get your instagram id or the replied user's id" },
		category: "info",
		guide: { en: "   {pn}\n   reply to a message + {pn}" }
	},

	onStart: async function ({ message, event, api }) {
		if (event.messageReply && event.messageReply.senderID) {
			let extra = "";
			try {
				const info = await api.getUserInfo(event.messageReply.senderID);
				const u = info[event.messageReply.senderID];
				if (u && u.username) extra = ` (@${u.username})`;
			} catch { /* id alone is fine */ }
			return message.reply(`${event.messageReply.senderID}${extra}`);
		}
		let me = `${event.senderID}`;
		if (event.senderUsername) me += ` (@${event.senderUsername})`;
		return message.reply(me);
	}
};
