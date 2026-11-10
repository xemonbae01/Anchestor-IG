module.exports = {
	config: {
		name: "promote",
		version: "1.0.0",
		author: "xemonbae01",
		countDown: 5,
		role: 1,
		description: { en: "make someone a group admin" },
		category: "group",
		guide: { en: "   reply to their message + {pn}\n   {pn} @username" }
	},

	onStart: async function ({ message, event, args, api }) {
		if (!event.isGroup) return message.reply("this only works in group threads");
		const client = api.rawClient;
		let targetID = null;
		let label = "";
		try {
			if (!args[0] && event.messageReply && event.messageReply.senderID) {
				targetID = String(event.messageReply.senderID);
				label = targetID;
			}
			else if (args[0] && /^\d+$/.test(args[0])) {
				targetID = args[0];
				label = args[0];
			}
			else if (args[0]) {
				const user = await client.getUserByUsername(args[0].replace(/^@/, ""));
				if (!user) return message.reply("user not found");
				targetID = String(user.id || user.pk);
				label = `@${user.username}`;
			}
		}
		catch (err) {
			return message.reply(`couldn't resolve that user: ${err.message}`);
		}
		if (!targetID) return message.SyntaxError();
		try {
			if (api.promoteAdmin) await api.promoteAdmin(event.threadID, targetID);
			else await client.promoteAdmin(event.threadID, [targetID]);
			return message.reply(`${label} is a group admin now`);
		}
		catch (err) {
			return message.reply(`promote failed: ${err.message}`);
		}
	}
};
