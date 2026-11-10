module.exports = {
	config: {
		name: "gif",
		version: "1.0.0",
		author: "xemonbae01",
		countDown: 5,
		role: 0,
		description: { en: "search and send a gif" },
		category: "fun",
		guide: { en: "   {pn} <search text>" }
	},

	onStart: async function ({ message, event, args, api }) {
		const client = api.rawClient;
		if (!client) return message.reply("ig client not available");
		if (!args.length) return message.SyntaxError();
		const query = args.join(" ");
		try {
			const results = await client.searchGifs(query);
			const list = Array.isArray(results) ? results : (results && (results.gifs || results.results)) || [];
			if (!list.length) return message.reply(`no gifs for "${query}"`);
			const first = list[0];
			const gifId = first.id || first.gifId || first;
			await client.sendGif(event.threadID, gifId);
			return null;
		}
		catch (err) {
			// some accounts can't send by id, sending by query works as fallback
			try {
				await client.sendGif(event.threadID, query);
				return null;
			}
			catch {
				return message.reply(`failed to send gif: ${err.message}`);
			}
		}
	}
};
