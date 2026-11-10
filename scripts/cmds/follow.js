module.exports = {
	config: {
		name: "follow",
		version: "1.0.0",
		author: "xemonbae01",
		countDown: 5,
		role: 2,
		description: { en: "check friendship status, follow or unfollow a user" },
		category: "social",
		guide: { en: "   {pn} @username: friendship status" +
			"\n   {pn} follow @username" +
			"\n   {pn} unfollow @username" }
	},

	onStart: async function ({ message, args, api }) {
		const client = api.rawClient;
		if (!client) return message.reply("ig client not available");
		let action = "status";
		let targetArg = args[0];
		if (["follow", "unfollow"].includes((args[0] || "").toLowerCase())) {
			action = args[0].toLowerCase();
			targetArg = args[1];
		}
		if (!targetArg) return message.SyntaxError();
		try {
			const user = await client.getUserByUsername(targetArg.replace(/^@/, ""));
			if (!user) return message.reply("user not found");
			const uid = String(user.id || user.pk);
			if (action === "follow") {
				await client.followUser(uid);
				return message.reply(`followed @${user.username}`);
			}
			if (action === "unfollow") {
				await client.unfollowUser(uid);
				return message.reply(`unfollowed @${user.username}`);
			}
			const status = await client.getFriendshipStatus(uid);
			if (!status) return message.reply(`@${user.username} (${uid})`);
			return message.reply(
				`@${user.username} (${uid})` +
				`\nfollowing: ${Boolean(status.following || status.isFollowing)}` +
				`\nfollowed by: ${Boolean(status.followedBy || status.isFollowedBy)}` +
				`\nblocking: ${Boolean(status.blocking || status.isBlocking)}`
			);
		}
		catch (err) {
			return message.reply(`failed: ${err.message}`);
		}
	}
};
