module.exports = {
	config: {
		name: "adduser",
		aliases: ["add"],
		version: "1.0.0",
		author: "xemonbae01",
		countDown: 5,
		role: 0,
		description: { en: "add users to this group thread" },
		category: "group",
		guide: { en: "   {pn} @username [@username2 ...]" }
	},

	onStart: async function ({ message, event, args, api }) {
		if (!event.isGroup) return message.reply("this only works in group threads");
		if (!args.length) return message.SyntaxError();
		const client = api.rawClient;
		const ids = [];
		const names = [];
		for (const arg of args) {
			try {
				const user = await client.getUserByUsername(arg.replace(/^@/, ""));
				if (!user) return message.reply(`user not found: ${arg}`);
				ids.push(String(user.id || user.pk));
				names.push(`@${user.username}`);
			}
			catch (err) {
				return message.reply(`couldn't resolve ${arg}: ${err.message}`);
			}
		}
		try {
			if (api.addParticipants) await api.addParticipants(event.threadID, ids);
			else await client.addParticipants(event.threadID, ids);
			return message.reply(`added ${names.join(", ")} to the group`);
		}
		catch (err) {
			return message.reply(`failed to add: ${err.message}`);
		}
	}
};
