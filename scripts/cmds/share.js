module.exports = {
	config: {
		name: "share",
		version: "1.0.0",
		author: "xemonbae01",
		countDown: 5,
		role: 0,
		description: { en: "share a post, reel, story or profile into this thread" },
		category: "media",
		guide: { en: "   {pn} post <url or media id>" +
			"\n   {pn} reel <url or media id>" +
			"\n   {pn} story <story media id>" +
			"\n   {pn} profile @username" }
	},

	onStart: async function ({ message, event, args, api }) {
		const type = (args[0] || "").toLowerCase();
		const value = args[1];
		if (!type || !value) return message.SyntaxError();
		const client = api.rawClient;
		try {
			if (type === "post") {
				if (api.sharePost) await api.sharePost(event.threadID, value);
				else await client.sharePost(event.threadID, value);
			}
			else if (type === "reel") {
				if (api.shareReel) await api.shareReel(event.threadID, value);
				else await client.shareReel(event.threadID, value);
			}
			else if (type === "story") {
				if (api.shareStory) await api.shareStory(event.threadID, value);
				else await client.shareStory(event.threadID, value);
			}
			else if (type === "profile") {
				if (api.shareProfile) await api.shareProfile(event.threadID, value.replace(/^@/, ""));
				else await client.shareProfile(event.threadID, value.replace(/^@/, ""));
			}
			else return message.SyntaxError();
			return message.send(`shared ${type} 📤`);
		}
		catch (err) {
			return message.reply(`share failed: ${err.message}`);
		}
	}
};
