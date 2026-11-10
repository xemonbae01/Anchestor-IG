module.exports = {
	config: {
		name: "leave",
		aliases: ["out"],
		version: "1.0.0",
		author: "xemonbae01",
		countDown: 5,
		role: 2,
		description: { en: "make the bot leave this group thread (asks first)" },
		category: "admin",
		guide: { en: "   {pn}: ask, then react to the message to confirm" }
	},

	langs: {
		en: {
			confirm: "react to this message to confirm i should leave this thread"
		}
	},

	onStart: async function ({ message, event, getLang }) {
		if (!event.isGroup) return message.reply("can't leave a dm like this");
		const info = await message.reply(getLang("confirm"));
		if (!info || !info.messageID) return message.reply("couldn't send the confirmation message, try again");
		global.Anchestor.onReaction.set(info.messageID, {
			commandName: "leave",
			messageID: info.messageID,
			threadID: event.threadID,
			senderID: event.senderID
		});
		return info;
	},

	onReaction: async function ({ message, event, api, onReaction }) {
		global.Anchestor.onReaction.delete(event.messageID);
		const client = api.rawClient;
		try {
			// say it before leaving, after leaving the thread is gone for the bot
			await message.reply("ok, leaving this thread 👋");
			if (api.leaveThread) await api.leaveThread(onReaction.threadID || event.threadID);
			else await client.leaveThread(onReaction.threadID || event.threadID);
		}
		catch (err) {
			global.utils.log.error("LEAVE", err.message);
		}
	}
};
