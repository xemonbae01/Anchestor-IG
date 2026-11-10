module.exports = {
	config: {
		name: "followreq",
		aliases: ["followrequests"],
		version: "1.0.0",
		author: "xemonbae01",
		countDown: 5,
		role: 2,
		description: { en: "pending follow requests: approve or ignore them" },
		category: "admin",
		guide: { en: "   {pn}: list follow requests" +
			"\n   then reply to the list with a number to approve, or \"no <number>\" to ignore" }
	},

	onStart: async function ({ message, event, api }) {
		const client = api.rawClient;
		try {
			const res = api.getPendingFollowRequests
				? await api.getPendingFollowRequests()
				: await client.getPendingFollowRequests();
			const users = Array.isArray(res) ? res : (res.users || []);
			if (!users.length) return message.reply("no pending follow requests");
			const lines = users.slice(0, 20).map((u, i) =>
				`${i + 1}. @${u.username || "?"} — ${u.fullName || ""} (${u.id || u.pk})`);
			const info = await message.reply("pending follow requests:\n" + lines.join("\n") +
				"\nreply with a number to approve, or \"no <number>\" to ignore");
			if (info && info.messageID) {
				global.Anchestor.onReply.set(info.messageID, {
					commandName: "followreq",
					messageID: info.messageID,
					threadID: event.threadID,
					senderID: event.senderID,
					items: users.slice(0, 20).map((u) => String(u.id || u.pk))
				});
			}
			return info;
		}
		catch (err) {
			return message.reply(`failed to load follow requests: ${err.message}`);
		}
	},

	onReply: async function ({ message, event, api, onReply }) {
		const items = (onReply && onReply.items) || [];
		const body = (event.body || "").trim().toLowerCase();
		const ignore = /^no\s+(\d+)$/.exec(body);
		const approve = /^(\d+)$/.exec(body);
		const num = ignore ? Number(ignore[1]) : approve ? Number(approve[1]) : null;
		if (!num || num < 1 || num > items.length) {
			await message.reply("reply with a number from the list (or \"no <number>\" to ignore)");
			return true;
		}
		const target = items[num - 1];
		const client = api.rawClient;
		try {
			if (ignore) {
				if (api.ignoreFollowRequest) await api.ignoreFollowRequest(target);
				else await client.ignoreFollowRequest(target);
				await message.reply(`ignored follow request ${num}`);
			}
			else {
				if (api.approveFollowRequest) await api.approveFollowRequest(target);
				else await client.approveFollowRequest(target);
				await message.reply(`approved follow request ${num}`);
			}
		}
		catch (err) {
			await message.reply(`failed: ${err.message}`);
		}
		return true;
	}
};
