module.exports = {
	config: {
		name: "edit",
		version: "1.0.0",
		author: "xemonbae01",
		countDown: 3,
		role: 0,
		description: { en: "edit one of the bot's own messages" },
		category: "utility",
		guide: { en: "   reply to a bot message + {pn} <new text>" +
			"\n   {pn} last <new text>: edit the last message the bot sent here" }
	},

	onStart: async function ({ message, event, args, api }) {
		if (!args.length) return message.SyntaxError();
		const client = api.rawClient;
		const doEdit = async (threadID, messageID, text) => {
			if (api.editMessage) return api.editMessage(threadID, messageID, text);
			return client.editMessage(threadID, messageID, text);
		};
		try {
			// -edit last <text>
			if (args[0].toLowerCase() === "last") {
				const text = args.slice(1).join(" ");
				if (!text) return message.SyntaxError();
				const last = global.temp && global.temp.lastBotMessage
					? global.temp.lastBotMessage[event.threadID] : null;
				if (!last || !last.messageID)
					return message.reply("i haven't sent anything here yet (or the bot restarted)");
				await doEdit(event.threadID, last.messageID, text);
				return message.send("edited ✏️");
			}

			// reply to one of my messages + -edit <text>
			if (!event.messageReply || !event.messageReply.messageID)
				return message.reply("reply to one of my messages and use -edit <new text>, or use -edit last <new text>");
			const botID = String(api.getCurrentUserID() || global.Anchestor.botID || "");
			if (event.messageReply.senderID && String(event.messageReply.senderID) !== botID)
				return message.reply("that message isn't mine, i can only edit my own messages");
			await doEdit(event.threadID, event.messageReply.messageID, args.join(" "));
			return message.send("edited ✏️");
		}
		catch (err) {
			return message.reply(`failed to edit: ${err.message}`);
		}
	}
};
