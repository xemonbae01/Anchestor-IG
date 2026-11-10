module.exports = {
	config: {
		name: "cmd",
		version: "1.0.0",
		author: "xemonbae01",
		countDown: 0,
		role: 2,
		description: { en: "load / unload / reload command files at runtime" },
		category: "admin",
		guide: { en: "   {pn} load <name>" +
			"\n   {pn} unload <name>" +
			"\n   {pn} reload <name>" }
	},

	onStart: async function ({ message, args, api }) {
		const loadScripts = require("../../bot/login/loadScripts");
		const action = (args[0] || "").toLowerCase();
		const name = (args[1] || "").toLowerCase();
		if (!name || !["load", "unload", "reload"].includes(action)) return message.SyntaxError();
		try {
			if (action === "load") {
				loadScripts.loadCommand(name);
				return message.reply(`command "${name}" loaded`);
			}
			if (action === "unload") {
				loadScripts.unloadCommand(name);
				return message.reply(`command "${name}" unloaded`);
			}
			loadScripts.reloadCommand(name);
			return message.reply(`command "${name}" reloaded`);
		}
		catch (err) {
			return message.reply(`failed: ${err.message}`);
		}
	}
};
