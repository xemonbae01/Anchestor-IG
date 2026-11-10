module.exports = {
	config: {
		name: "theme",
		version: "1.0.0",
		author: "xemonbae01",
		countDown: 5,
		role: 0,
		description: { en: "list or change the chat theme" },
		category: "group",
		guide: { en: "   {pn} list" +
			"\n   {pn} set <theme name or id>" +
			"\n   {pn} reset" }
	},

	onStart: async function ({ message, event, args, api }) {
		const client = api.rawClient;
		if (!client) return message.reply("ig client not available");
		const action = (args[0] || "list").toLowerCase();
		try {
			if (action === "list") {
				let themes = [];
				try { themes = await client.fetchChatThemes(event.threadID); } catch { /* fallback below */ }
				if (!themes || !themes.length) themes = client.getAvailableThemes() || [];
				if (!themes.length) return message.reply("no themes found");
				const lines = themes.slice(0, 25).map((t, i) => `${i + 1}. ${t.name || t.title || t.id} (${t.id})`);
				return message.reply("chat themes:\n" + lines.join("\n") + "\n\nuse: theme set <name>");
			}
			if (action === "reset") {
				await client.resetChatTheme(event.threadID);
				return message.reply("chat theme reset");
			}
			if (action === "set") {
				const query = args.slice(1).join(" ");
				if (!query) return message.SyntaxError();
				let themeId = query;
				if (!/^\d+$/.test(query)) {
					const found = await client.searchChatThemes(query);
					const first = Array.isArray(found) ? found[0] : found && found.themes ? found.themes[0] : null;
					if (!first) return message.reply(`no theme matching "${query}"`);
					themeId = String(first.id || first.themeId);
				}
				await client.setChatTheme(event.threadID, themeId);
				return message.reply(`theme changed (id: ${themeId})`);
			}
			return message.SyntaxError();
		}
		catch (err) {
			return message.reply(`failed: ${err.message}`);
		}
	}
};
