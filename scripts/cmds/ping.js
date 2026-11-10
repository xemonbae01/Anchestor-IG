module.exports = {
	config: {
		name: "ping",
		version: "1.0.0",
		author: "xemonbae01",
		countDown: 2,
		role: 0,
		description: { en: "check if the bot is alive" },
		category: "info",
		guide: { en: "   {pn}" }
	},

	onStart: async function ({ message, event }) {
		const start = Date.now();
		const sentAt = event.timestamp || start;
		const latency = Math.max(0, start - Math.min(sentAt, start));
		const uptime = global.utils.convertTime(Date.now() - global.Anchestor.startTime);
		const info = await message.reply(`pong 🏓\nlatency: ~${latency}ms\nuptime: ${uptime}`);
		if (info && info.messageID) {
			const round = Date.now() - start;
			// second line with the real round trip, edit isn't a thing everywhere so just send small followup only if slow
			if (round > 2000) await message.send(`(that reply took ${round}ms)`);
		}
		return info;
	}
};
