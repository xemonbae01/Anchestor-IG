module.exports = {
	config: {
		name: "pin",
		version: "1.0.0",
		author: "xemonbae01",
		countDown: 3,
		role: 0,
		description: { en: "pin / unpin / list pinned messages in this thread" },
		category: "utility",
		guide: { en: "   reply to a message + {pn}: pin it" +
			"\n   reply to a pinned message + {pn} off: unpin it" +
			"\n   {pn} list: pinned messages" }
	},

	onStart: async function ({ message, event, args, api }) {
		const client = api.rawClient;
		const pinIt = api.pinMessage ? api.pinMessage.bind(api) : (t, m) => client.pinMessage(t, m);
		const unpinIt = api.unpinMessage ? api.unpinMessage.bind(api) : (t, m) => client.unpinMessage(t, m);
		const getPinned = api.getPinnedMessages ? api.getPinnedMessages.bind(api) : (t) => client.getPinnedMessages(t);
		const action = (args[0] || "").toLowerCase();
		try {
			if (action === "list") {
				const pinned = await getPinned(event.threadID);
				const list = Array.isArray(pinned) ? pinned : [];
				if (!list.length) return message.reply("no pinned messages in this thread");
				const lines = list.slice(0, 10).map((m, i) => {
					const who = (m.sender && (m.sender.username || m.sender.fullName)) || m.senderId || "?";
					const when = m.createdAt ? new Date(m.createdAt).toLocaleString("en-GB") : "";
					return `${i + 1}. @${who}: ${(m.text || "(media)").slice(0, 80)}${when ? `\n   ${when}` : ""}`;
				});
				return message.reply("pinned messages:\n" + lines.join("\n"));
			}
			if (!event.messageReply || !event.messageReply.messageID)
				return message.reply("reply to a message and use -pin (or -pin list)");
			if (action === "off" || action === "unpin") {
				await unpinIt(event.threadID, event.messageReply.messageID);
				return message.send("unpinned 📌");
			}
			await pinIt(event.threadID, event.messageReply.messageID);
			return message.send("pinned 📌");
		}
		catch (err) {
			return message.reply(`pin failed: ${err.message}`);
		}
	}
};
