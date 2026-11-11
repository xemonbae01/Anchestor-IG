module.exports = {
	config: {
		name: "usage",
		version: "1.0.0",
		author: "xemonbae01",
		countDown: 5,
		role: 0,
		description: { en: "which commands get used the most" },
		category: "system",
		guide: { en: "   {pn}: top 10 most used commands + total" }
	},

	onStart: async function ({ message, globalData }) {
		const stats = (await globalData.get("commandUsage")) || global.Anchestor._usageCache || {};
		const total = (await globalData.get("commandUsageTotal")) || global.Anchestor._usageTotal || 0;
		const top = Object.entries(stats)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 10);
		if (!top.length) return message.reply("no command usage recorded yet");
		const lines = top.map(([name, count], i) => `${i + 1}. ${name} — ${count}`);
		return message.reply(`『 command usage 』\n${lines.join("\n")}\ntotal commands run: ${total}`);
	}
};
