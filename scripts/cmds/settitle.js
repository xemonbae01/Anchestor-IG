module.exports = {
	config: {
		name: "settitle",
		aliases: ["renamethread"],
		version: "1.0.0",
		author: "xemonbae01",
		countDown: 5,
		role: 0,
		description: { en: "change this group thread's title" },
		category: "group",
		guide: { en: "   {pn} <new title>" }
	},

	onStart: async function ({ message, event, args, api }) {
		if (!event.isGroup) return message.reply("this only works in group threads");
		const title = args.join(" ").trim();
		if (!title) return message.SyntaxError();
		try {
			if (api.setThreadTitle) await api.setThreadTitle(event.threadID, title);
			else if (api.changeThreadTitle) await api.changeThreadTitle(title, event.threadID);
			else await api.rawClient.setThreadTitle(event.threadID, title);
			return message.reply(`thread title set to: ${title}`);
		}
		catch (err) {
			return message.reply(`failed to set title: ${err.message}`);
		}
	}
};
