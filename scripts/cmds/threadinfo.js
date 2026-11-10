module.exports = {
	config: {
		name: "threadinfo",
		aliases: ["boxinfo", "gcinfo"],
		version: "1.0.0",
		author: "xemonbae01",
		countDown: 5,
		role: 0,
		description: { en: "info about this thread" },
		category: "info",
		guide: { en: "   {pn}" }
	},

	onStart: async function ({ message, event, api, threadsData }) {
		try {
			const info = await api.getThreadInfo(event.threadID);
			const data = await threadsData.get(event.threadID);
			let text = `『 ${info.threadName || "Direct Message"} 』` +
				`\nthread id: ${info.threadID}` +
				`\ntype: ${info.isGroup ? "group" : "dm"}` +
				`\nmembers: ${(info.userInfo || []).length}` +
				`\nmessages tracked: ${data.messageCount || 0}`;
			if (info.adminIDs && info.adminIDs.length) text += `\nadmins: ${info.adminIDs.join(", ")}`;
			if (info.userInfo && info.userInfo.length) {
				text += "\n— members —";
				for (const u of info.userInfo.slice(0, 30)) {
					const nick = info.nicknames && info.nicknames[u.id];
					text += `\n• @${u.username || u.id}${u.name ? ` (${u.name})` : ""}${nick ? ` — "${nick}"` : ""}`;
				}
			}
			const nickEntries = info.nicknames ? Object.entries(info.nicknames).filter(([, v]) => v) : [];
			if (nickEntries.length && !(info.userInfo && info.userInfo.length)) {
				text += "\n— nicknames —";
				for (const [uid, nick] of nickEntries) text += `\n• ${uid}: ${nick}`;
			}
			return message.reply(text);
		}
		catch (err) {
			return message.reply(`failed to fetch thread: ${err.message}`);
		}
	}
};
