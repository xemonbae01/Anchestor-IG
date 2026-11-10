module.exports = {
	config: {
		name: "spy",
		aliases: ["intel"],
		version: "1.0.0",
		author: "xemonbae01",
		countDown: 5,
		role: 0,
		description: { en: "full intel on a user: profile, counts, friendship, note" },
		category: "info",
		guide: { en: "   {pn} @username\n   {pn} (on yourself)\n   reply to a message + {pn}" }
	},

	onStart: async function ({ message, event, args, api }) {
		const client = api.rawClient;
		if (!client) return message.reply("ig client not available");
		try {
			let user = null;
			if (args[0]) user = await client.getUserByUsername(args[0].replace(/^@/, ""));
			else if (event.messageReply && event.messageReply.senderID) user = await client.getUserById(event.messageReply.senderID);
			else if (event.senderUsername) user = await client.getUserByUsername(event.senderUsername);
			else user = await client.getUserById(event.senderID);
			if (!user) return message.reply("user not found");

			const uid = String(user.id || user.pk || "");
			let text = `🕵️ spy report — @${user.username || "?"}` +
				`\nname: ${user.fullName || "-"}` +
				`\nid: ${uid}` +
				`\nverified: ${user.isVerified ? "yes ✓" : "no"}` +
				`\nprivate: ${user.isPrivate ? "yes" : "no"}` +
				`\nfollowers: ${user.followerCount ?? "?"}` +
				`\nfollowing: ${user.followingCount ?? "?"}` +
				`\nposts: ${user.mediaCount ?? "?"}`;
			if (user.biography) text += `\nbio: ${user.biography}`;

			if (uid) {
				try {
					const st = await client.getFriendshipStatus(uid);
					if (st) {
						text += `\nfriendship:` +
							`\n  following: ${Boolean(st.following)}` +
							`\n  followed by: ${Boolean(st.followedBy)}` +
							`\n  request out: ${Boolean(st.outgoingRequest)}` +
							`\n  request in: ${Boolean(st.incomingRequest)}` +
							`\n  blocking: ${Boolean(st.blocking)}`;
						if (st.isBestie !== undefined) text += `\n  bestie: ${Boolean(st.isBestie)}`;
					}
				} catch { /* friendship can fail on private targets */ }

				try {
					const note = await client.getNoteByUser(user.username || uid);
					if (note) text += `\ncurrent note: ${note.text || note.content || JSON.stringify(note)}`;
				} catch { /* no note, nothing to add */ }
			}

			if (user.profilePicUrlHd || user.profilePicUrl)
				text += `\npic: ${user.profilePicUrlHd || user.profilePicUrl}`;
			return message.reply(text);
		}
		catch (err) {
			return message.reply(`spy failed: ${err.message}`);
		}
	}
};
