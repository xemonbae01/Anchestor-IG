module.exports = {
	config: {
		name: "following",
		version: "1.0.0",
		author: "xemonbae01",
		countDown: 5,
		role: 0,
		description: { en: "list who a user follows (first 20)" },
		category: "social",
		guide: { en: "   {pn} @username\n   {pn} (your own following list)" }
	},

	onStart: async function ({ message, event, args, api }) {
		const client = api.rawClient;
		if (!client) return message.reply("ig client not available");
		try {
			let uid = null;
			let label = "";
			if (args[0]) {
				const user = await client.getUserByUsername(args[0].replace(/^@/, ""));
				if (!user) return message.reply("user not found");
				uid = String(user.id || user.pk);
				label = `@${user.username}`;
			}
			else {
				uid = String(event.senderID);
				label = "you";
			}
			const res = api.getFollowing ? await api.getFollowing(uid, { limit: 20 }) : await client.getFollowing(uid, { limit: 20 });
			const users = Array.isArray(res) ? res : (res.users || []);
			if (!users.length) return message.reply(`no following list found for ${label} (private accounts hide the list)`);
			const lines = users.slice(0, 20).map((u, i) => `${i + 1}. @${u.username || "?"}${u.fullName ? ` — ${u.fullName}` : ""}`);
			return message.reply(`${label} follows (showing ${Math.min(users.length, 20)}):\n` + lines.join("\n") +
				(res && res.hasMore ? "\n...and more" : ""));
		}
		catch (err) {
			return message.reply(`failed to load following: ${err.message}`);
		}
	}
};
