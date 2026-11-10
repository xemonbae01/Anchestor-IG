module.exports = {
	config: {
		name: "userinfo",
		aliases: ["whois"],
		version: "1.0.0",
		author: "xemonbae01",
		countDown: 5,
		role: 0,
		description: { en: "instagram profile info of a user" },
		category: "info",
		guide: { en: "   {pn} @username\n   {pn} (your own info)\n   reply to a message + {pn}" }
	},

	onStart: async function ({ message, event, args, api }) {
		const client = api.rawClient;
		if (!client) return message.reply("ig client not available");
		try {
			let user = null;
			if (args[0]) {
				const username = args[0].replace(/^@/, "");
				user = await client.getUserByUsername(username).catch(() => null);
				if (!user) user = await client.getProfile(username);
			}
			else if (event.messageReply && event.messageReply.senderID) {
				user = await client.getUserById(event.messageReply.senderID);
			}
			else {
				user = event.senderUsername
					? await client.getUserByUsername(event.senderUsername)
					: await client.getUserById(event.senderID);
			}
			if (!user) return message.reply("user not found");
			const uid = String(user.id || user.pk || "");
			let text = `『 ${user.fullName || user.username || uid} 』` +
				`\nusername: @${user.username || "?"}` +
				`\nid: ${uid}` +
				`\nverified: ${user.isVerified ? "yes" : "no"}` +
				`\nprivate: ${user.isPrivate ? "yes" : "no"}`;
			if (user.biography) text += `\nbio: ${user.biography}`;
			if (user.followerCount !== undefined && user.followerCount !== null) text += `\nfollowers: ${user.followerCount}`;
			if (user.followingCount !== undefined && user.followingCount !== null) text += `\nfollowing: ${user.followingCount}`;
			if (user.mediaCount !== undefined && user.mediaCount !== null) text += `\nposts: ${user.mediaCount}`;
			if (uid) {
				try {
					const fs2 = await client.getFriendshipStatus(uid);
					if (fs2) text += `\nfriendship: following=${Boolean(fs2.following || fs2.isFollowing)}, followed by=${Boolean(fs2.followedBy || fs2.isFollowedBy)}`;
				} catch { /* not critical */ }
			}
			if (user.profilePicUrl) text += `\npic: ${user.profilePicUrl}`;
			return message.reply(text);
		}
		catch (err) {
			return message.reply(`failed to fetch user: ${err.message}`);
		}
	}
};
