module.exports = {
	config: {
		name: "note",
		version: "1.0.0",
		author: "xemonbae01",
		countDown: 5,
		role: 0,
		description: { en: "instagram notes: see feed notes, post or delete yours" },
		category: "social",
		guide: { en: "   {pn}: notes from people you follow" +
			"\n   {pn} post <text>: post a note" +
			"\n   {pn} mine: your current note" +
			"\n   {pn} delete: delete your note" }
	},

	onStart: async function ({ message, args, api }) {
		const client = api.rawClient;
		if (!client) return message.reply("ig client not available");
		const action = (args[0] || "").toLowerCase();
		try {
			if (action === "post") {
				const text = args.slice(1).join(" ");
				if (!text) return message.SyntaxError();
				await client.createNote(text);
				return message.reply("note posted 📝");
			}
			if (action === "delete" || action === "del") {
				await client.deleteNote();
				return message.reply("your note was deleted");
			}
			if (action === "mine") {
				const mine = await client.getMyNote();
				if (!mine) return message.reply("you don't have a note up right now");
				return message.reply(`your note: ${mine.text || mine.content || JSON.stringify(mine)}`);
			}
			const notes = await client.getNotes();
			const list = Array.isArray(notes) ? notes : (notes && notes.notes) || [];
			if (!list.length) return message.reply("no notes in your feed right now");
			const lines = list.slice(0, 15).map((n) => {
				const who = (n.user && (n.user.username || n.user.fullName)) || n.username || "unknown";
				return `• @${who}: ${n.text || n.content || ""}`;
			});
			return message.reply("notes:\n" + lines.join("\n"));
		}
		catch (err) {
			return message.reply(`failed: ${err.message}`);
		}
	}
};
