module.exports = {
	config: {
		name: "restart",
		version: "1.0.0",
		author: "xemonbae01",
		countDown: 0,
		role: 2,
		description: { en: "restart the bot" },
		category: "admin",
		guide: { en: "   {pn}" }
	},

	onStart: async function ({ message }) {
		await message.reply("restarting...");
		// index.js respawns the bot when it exits with code 2
		setTimeout(() => process.exit(2), 500);
	}
};
