module.exports = {
	config: {
		name: "uptime",
		aliases: ["up"],
		version: "1.0.0",
		author: "xemonbae01",
		countDown: 3,
		role: 0,
		description: { en: "how long the bot has been running" },
		category: "info",
		guide: { en: "   {pn}" }
	},

	onStart: async function ({ message }) {
		const up = global.utils.convertTime(Date.now() - global.Anchestor.startTime);
		const cmds = global.Anchestor.commands.size;
		return message.reply(`anchestor has been up for ${up}\n${cmds} commands loaded`);
	}
};
