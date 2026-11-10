module.exports = {
	config: {
		name: "prefix",
		version: "1.0.0",
		author: "xemonbae01",
		countDown: 5,
		role: 0,
		description: { en: "change the command prefix for this thread or globally" },
		category: "config",
		guide: { en: "   {pn} <new prefix>: change prefix in this thread" +
			"\n   {pn} <new prefix> -g: change the global prefix (bot admin only)" +
			"\n   {pn} reset: back to the default prefix" }
	},

	langs: {
		en: {
			confirmGlobal: "react to this message to confirm changing the global prefix to: %1",
			confirmThread: "react to this message to confirm changing this thread's prefix to: %1",
			setGlobal: "global prefix changed to: %1",
			setThread: "prefix for this thread changed to: %1",
			resetGlobal: "global prefix reset to: %1",
			resetThread: "prefix for this thread reset to: %1",
			current: "current prefix: %1\nglobal prefix: %2",
			onlyAdmin: "only bot admins can change the global prefix"
		}
	},

	onStart: async function ({ message, event, args, role, threadsData, globalData, getLang, prefix }) {
		if (!args[0]) return message.SyntaxError();
		const globalPrefix = (await globalData.get("prefix")) || global.Anchestor.config.prefix;

		if (args[0].toLowerCase() === "reset") {
			if (args[1] === "-g") {
				if (role < 2) return message.reply(getLang("onlyAdmin"));
				await globalData.set("prefix", global.Anchestor.config.prefix);
				return message.reply(getLang("resetGlobal", global.Anchestor.config.prefix));
			}
			await threadsData.set(event.threadID, null, "data.prefix");
			return message.reply(getLang("resetThread", globalPrefix));
		}

		const newPrefix = args[0];
		const isGlobal = args[1] === "-g";
		if (isGlobal && role < 2) return message.reply(getLang("onlyAdmin"));

		const info = await message.reply(getLang(isGlobal ? "confirmGlobal" : "confirmThread", newPrefix));
		if (!info || !info.messageID) return message.reply("couldn't send the confirmation message, try again");

		global.Anchestor.onReaction.set(info.messageID, {
			commandName: "prefix",
			messageID: info.messageID,
			threadID: event.threadID,
			senderID: event.senderID,
			newPrefix,
			isGlobal
		});
		return info;
	},

	onReaction: async function ({ message, event, onReaction, threadsData, globalData, getLang }) {
		const { newPrefix, isGlobal, threadID } = onReaction;
		global.Anchestor.onReaction.delete(event.messageID);
		if (isGlobal) {
			await globalData.set("prefix", newPrefix);
			// utils.getPrefix reads thread data then config, so keep config in sync too
			global.Anchestor.config.prefix = newPrefix;
			return message.reply(getLang("setGlobal", newPrefix));
		}
		await threadsData.set(threadID, newPrefix, "data.prefix");
		return message.reply(getLang("setThread", newPrefix));
	},

	onChat: async function ({ message, event, threadsData, globalData }) {
		// just typing "prefix" shows the current one
		if (!event.body || event.body.trim().toLowerCase() !== "prefix") return false;
		const globalPrefix = (await globalData.get("prefix")) || global.Anchestor.config.prefix;
		const threadPrefix = await threadsData.get(event.threadID, "data.prefix");
		await message.reply(`prefix in this thread: ${threadPrefix || globalPrefix}\nglobal prefix: ${globalPrefix}`);
		return true;
	}
};
