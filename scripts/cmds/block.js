module.exports = {
	config: {
		name: "block",
		version: "1.0.0",
		author: "xemonbae01",
		countDown: 5,
		role: 2,
		description: { en: "block a user on instagram" },
		category: "admin",
		guide: { en: "   {pn} @username" }
	},

	onStart: async function ({ message, args, api }) {
		if (!args[0]) return message.SyntaxError();
		const client = api.rawClient;
		try {
			const user = await client.getUserByUsername(args[0].replace(/^@/, ""));
			if (!user) return message.reply("user not found");
			if (api.blockUser) await api.blockUser(String(user.id || user.pk));
			else await client.blockUser(String(user.id || user.pk));
			return message.reply(`blocked @${user.username} 🚫`);
		}
		catch (err) {
			return message.reply(`block failed: ${err.message}`);
		}
	}
};
