module.exports = {
	config: {
		name: "mute",
		version: "1.0.0",
		author: "xemonbae01",
		countDown: 3,
		role: 0,
		description: { en: "mute or unmute this thread for the bot account" },
		category: "group",
		guide: { en: "   {pn}: mute this thread\n   {pn} off: unmute" }
	},

	onStart: async function ({ message, event, args, role, api }) {
		// muting a group is an admin thing, in dm it's just your own inbox
		if (event.isGroup && role < 1) return message.reply("only group admins can mute the thread");
		const off = (args[0] || "").toLowerCase() === "off";
		const client = api.rawClient;
		try {
			if (api.muteThread) await api.muteThread(event.threadID, !off);
			else await client.muteThread(event.threadID, !off);
			return message.reply(off ? "thread unmuted 🔔" : "thread muted 🔕");
		}
		catch (err) {
			return message.reply(`mute failed: ${err.message}`);
		}
	}
};
