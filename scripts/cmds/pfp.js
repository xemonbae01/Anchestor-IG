module.exports = {
	config: {
		name: "pfp",
		aliases: ["avatar"],
		version: "1.0.0",
		author: "xemonbae01",
		countDown: 5,
		role: 0,
		description: { en: "send someone's profile picture in hd" },
		category: "media",
		guide: { en: "   {pn} @username\n   {pn} (your own pfp)\n   reply to a message + {pn}" }
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

			const pic = user.profilePicUrlHd || user.profilePicUrl;
			const label = `@${user.username || "?"} — ${user.fullName || ""}`.trim();
			if (!pic) return message.reply(`${label}\nno profile picture`);
			try {
				if (api.sendImageFromUrl) await api.sendImageFromUrl(event.threadID, pic);
				else await client.sendImageFromUrl(event.threadID, pic);
				return message.send(label);
			}
			catch {
				// image send can fail on some accounts, the link still works
				return message.reply(`${label}\npic: ${pic}`);
			}
		}
		catch (err) {
			return message.reply(`failed to get pfp: ${err.message}`);
		}
	}
};
