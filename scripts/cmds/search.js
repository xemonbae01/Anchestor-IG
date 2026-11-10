module.exports = {
	config: {
		name: "search",
		aliases: ["find"],
		version: "1.0.0",
		author: "xemonbae01",
		countDown: 5,
		role: 0,
		description: { en: "search messages inside this thread" },
		category: "utility",
		guide: { en: "   {pn} <text to search>" }
	},

	onStart: async function ({ message, event, args, api }) {
		if (!args.length) return message.SyntaxError();
		const query = args.join(" ");
		const client = api.rawClient;
		try {
			const res = api.searchInThread
				? await api.searchInThread(event.threadID, query)
				: await client.searchInThread(event.threadID, query);
			const msgs = Array.isArray(res) ? res : (res.messages || res.items || []);
			if (!msgs.length) return message.reply(`nothing found for "${query}" in this thread`);
			const lines = msgs.slice(0, 10).map((m, i) => {
				const who = (m.sender && (m.sender.username || m.sender.fullName)) || m.senderId || "?";
				const when = m.createdAt ? new Date(m.createdAt).toLocaleString("en-GB")
					: m.timestamp ? new Date(m.timestamp).toLocaleString("en-GB") : "";
				return `${i + 1}. @${who}: ${(m.text || "(media)").slice(0, 80)}${when ? `\n   ${when}` : ""}`;
			});
			return message.reply(`results for "${query}":\n` + lines.join("\n"));
		}
		catch (err) {
			return message.reply(`search failed: ${err.message}`);
		}
	}
};
