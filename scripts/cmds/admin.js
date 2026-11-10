module.exports = {
	config: {
		name: "admin",
		version: "1.0.0",
		author: "xemonbae01",
		countDown: 3,
		role: 0,
		description: { en: "list / add / remove bot admins" },
		category: "admin",
		guide: { en: "   {pn} list" +
			"\n   {pn} add <user id or reply>" +
			"\n   {pn} remove <user id or reply>" }
	},

	langs: {
		en: {
			list: "bot admins:\n%1",
			added: "added %1 as bot admin",
			removed: "removed %1 from bot admins",
			already: "%1 is already an admin",
			notAdmin: "%1 is not an admin",
			onlyAdmin: "only bot admins can do that"
		}
	},

	// admins from config + admins added at runtime (globalData)
	async allAdmins(globalData) {
		const fromConfig = (global.Anchestor.config.adminBot || []).map(String);
		const stored = (await globalData.get("adminBot")) || [];
		return { fromConfig, stored: stored.map(String), all: [...new Set([...fromConfig, ...stored.map(String)])] };
	},

	onStart: async function ({ message, event, args, role, globalData, getLang }) {
		const { allAdmins } = module.exports;
		const action = (args[0] || "list").toLowerCase();

		if (action === "list") {
			const { all } = await allAdmins(globalData);
			if (!all.length) return message.reply("no bot admins set. add your id in config.json adminBot");
			return message.reply(getLang("list", all.map((id) => `• ${id}`).join("\n")));
		}

		if (role < 2) return message.reply(getLang("onlyAdmin"));

		let target = args[1];
		if (!target && event.messageReply) target = event.messageReply.senderID;
		if (!target) return message.SyntaxError();
		target = String(target).replace(/^@/, "");

		const { fromConfig, stored } = await allAdmins(globalData);
		if (action === "add") {
			if (fromConfig.includes(target) || stored.includes(target)) return message.reply(getLang("already", target));
			stored.push(target);
			await globalData.set("adminBot", stored);
			return message.reply(getLang("added", target));
		}
		if (action === "remove" || action === "rm") {
			if (fromConfig.includes(target)) return message.reply("that admin is in config.json, remove it from there");
			if (!stored.includes(target)) return message.reply(getLang("notAdmin", target));
			await globalData.set("adminBot", stored.filter((id) => id !== target));
			return message.reply(getLang("removed", target));
		}
		return message.SyntaxError();
	}
};
