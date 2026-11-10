module.exports = {
	config: {
		name: "inbox",
		version: "1.0.0",
		author: "xemonbae01",
		countDown: 5,
		role: 2,
		description: { en: "list the latest conversations in the inbox" },
		category: "admin",
		guide: { en: "   {pn}" }
	},

	onStart: async function ({ message, api }) {
		const client = api.rawClient;
		if (!client) return message.reply("ig client not available");
		try {
			const convs = await client.getInbox({ limit: 10 });
			const list = Array.isArray(convs) ? convs : (convs && convs.conversations) || [];
			if (!list.length) return message.reply("inbox is empty");
			const lines = list.slice(0, 10).map((c, i) => {
				const unread = c.hasUnread ? "• " : "  ";
				const title = c.title || (c.participants || []).map((u) => u.username).join(", ") || c.id;
				return `${unread}${i + 1}. ${title} [${c.id}]${c.isGroup ? " (group)" : ""}`;
			});
			return message.reply("latest conversations:\n" + lines.join("\n"));
		}
		catch (err) {
			return message.reply(`failed: ${err.message}`);
		}
	}
};
