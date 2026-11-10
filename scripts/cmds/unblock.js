module.exports = {
	config: {
		name: "unblock",
		version: "1.0.0",
		author: "xemonbae01",
		countDown: 5,
		role: 2,
		description: { en: "unblock a user on instagram" },
		category: "admin",
		guide: { en: "   {pn} @username" }
	},

	onStart: async function ({ message, args, api }) {
		if (!args[0]) return message.SyntaxError();
		const client = api.rawClient;
		try {
			const user = await client.getUserByUsername(args[0].replace(/^@/, ""));
			if (!user) return message.reply("user not found");
			if (api.unblockUser) await api.unblockUser(String(user.id || user.pk));
			else await client.unblockUser(String(user.id || user.pk));
			return message.reply(`unblocked @${user.username}`);
		}
		catch (err) {
			return message.reply(`unblock failed: ${err.message}`);
		}
	}
};
