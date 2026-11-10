const fs = require("fs");

module.exports = {
	config: {
		name: "adminonly",
		version: "1.0.0",
		author: "xemonbae01",
		countDown: 3,
		role: 2,
		description: { en: "turn admin-only mode on or off (only bot admins can use the bot)" },
		category: "admin",
		guide: { en: "   {pn} on\n   {pn} off\n   {pn} status" }
	},

	langs: {
		en: {
			on: "admin-only mode is ON. only bot admins can use me now",
			off: "admin-only mode is OFF. everyone can use me again",
			status: "admin-only mode: %1"
		}
	},

	onStart: async function ({ message, args, getLang }) {
		const action = (args[0] || "").toLowerCase();
		const cfg = global.Anchestor.config;
		cfg.adminOnly = cfg.adminOnly || { enable: false, ignoreCommand: [] };

		if (action === "on" || action === "off") {
			cfg.adminOnly.enable = action === "on";
			// save it or a restart would forget
			fs.writeFileSync(global.client.dirConfig, JSON.stringify(cfg, null, 2));
			return message.reply(getLang(action));
		}
		if (action === "status" || !action)
			return message.reply(getLang("status", cfg.adminOnly.enable ? "on" : "off") +
				(!action ? `\nusage: -adminonly on / off` : ""));
		return message.SyntaxError();
	}
};
