module.exports = {
	config: {
		name: "kick",
		version: "1.0.0",
		author: "xemonbae01",
		countDown: 5,
		role: 1,
		description: { en: "remove someone from this group thread" },
		category: "group",
		guide: { en: "   reply to their message + {pn}\n   {pn} @username" }
	},

	// figure out who gets kicked: replied sender or @username
	async resolveTarget({ event, args, api }) {
		if (!args[0] && event.messageReply && event.messageReply.senderID)
			return { id: String(event.messageReply.senderID), label: event.messageReply.senderID };
		if (!args[0]) return null;
		const client = api.rawClient;
		if (/^\d+$/.test(args[0])) return { id: args[0], label: args[0] };
		const user = await client.getUserByUsername(args[0].replace(/^@/, ""));
		if (!user) return null;
		return { id: String(user.id || user.pk), label: `@${user.username}` };
	},

	onStart: async function ({ message, event, args, api }) {
		if (!event.isGroup) return message.reply("this only works in group threads");
		let target = null;
		try {
			target = await module.exports.resolveTarget({ event, args, api });
		}
		catch (err) {
			return message.reply(`couldn't resolve that user: ${err.message}`);
		}
		if (!target) return message.SyntaxError();

		const botID = String(api.getCurrentUserID() || global.Anchestor.botID || "");
		if (target.id === botID) return message.reply("nah, not kicking myself");

		// bot admins are untouchable here
		const adminIds = new Set((global.Anchestor.config.adminBot || []).map(String));
		try {
			const stored = global.db.globalData ? global.db.globalData.peek("adminBot") : null;
			if (Array.isArray(stored)) for (const id of stored) adminIds.add(String(id));
		} catch { /* ignore */ }
		if (adminIds.has(target.id)) return message.reply("can't kick a bot admin");

		try {
			if (api.removeParticipant) await api.removeParticipant(event.threadID, target.id);
			else await api.rawClient.removeParticipant(event.threadID, [target.id]);
			return message.reply(`kicked ${target.label}`);
		}
		catch (err) {
			return message.reply(`kick failed: ${err.message}`);
		}
	}
};
