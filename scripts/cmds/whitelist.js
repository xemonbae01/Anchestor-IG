const fs = require("fs");

module.exports = {
	config: {
		name: "whitelist",
		aliases: ["wl"],
		version: "1.0.0",
		author: "xemonbae01",
		countDown: 3,
		role: 2,
		description: { en: "whitelist mode: only listed users / threads can use the bot" },
		category: "admin",
		guide: { en: "   {pn} on / off: user whitelist mode" +
			"\n   {pn} add <user id or @username>" +
			"\n   {pn} remove <user id>" +
			"\n   {pn} list" +
			"\n   {pn} thread: toggle this thread in the thread whitelist" }
	},

	save() {
		fs.writeFileSync(global.client.dirConfig, JSON.stringify(global.Anchestor.config, null, 2));
	},

	onStart: async function ({ message, event, args, api }) {
		const save = module.exports.save;
		const cfg = global.Anchestor.config;
		cfg.whiteListMode = cfg.whiteListMode || { enable: false, whiteListIds: [] };
		cfg.whiteListModeThread = cfg.whiteListModeThread || { enable: false, whiteListThreadIds: [] };
		const wl = cfg.whiteListMode;
		wl.whiteListIds = (wl.whiteListIds || []).map(String);
		const wlt = cfg.whiteListModeThread;
		wlt.whiteListThreadIds = (wlt.whiteListThreadIds || []).map(String);

		const action = (args[0] || "").toLowerCase();

		if (!action) {
			return message.reply(
				`whitelist mode: ${wl.enable ? "on" : "off"}` +
				`\nusers: ${wl.whiteListIds.length ? wl.whiteListIds.join(", ") : "(none)"}` +
				`\nthread whitelist: ${wlt.enable ? "on" : "off"}` +
				`\nthreads: ${wlt.whiteListThreadIds.length ? wlt.whiteListThreadIds.join(", ") : "(none)"}` +
				`\nbot admins always bypass both lists`
			);
		}

		if (action === "on" || action === "off") {
			wl.enable = action === "on";
			save();
			return message.reply(`whitelist mode is ${action.toUpperCase()} now` +
				(action === "on" ? "\nonly listed users can use me (bot admins bypass)" : ""));
		}

		if (action === "thread") {
			const tid = String(event.threadID);
			if (!wlt.whiteListThreadIds.includes(tid)) {
				wlt.whiteListThreadIds.push(tid);
				wlt.enable = true;
				save();
				return message.reply(`this thread (${tid}) is whitelisted now, thread whitelist mode is on`);
			}
			wlt.whiteListThreadIds = wlt.whiteListThreadIds.filter((id) => id !== tid);
			if (!wlt.whiteListThreadIds.length) wlt.enable = false;
			save();
			return message.reply(`this thread was removed from the thread whitelist`);
		}

		if (action === "list") {
			return message.reply(
				`whitelisted users (${wl.enable ? "mode on" : "mode off"}):\n` +
				(wl.whiteListIds.length ? wl.whiteListIds.map((id) => `• ${id}`).join("\n") : "(none)") +
				`\nwhitelisted threads (${wlt.enable ? "mode on" : "mode off"}):\n` +
				(wlt.whiteListThreadIds.length ? wlt.whiteListThreadIds.map((id) => `• ${id}`).join("\n") : "(none)")
			);
		}

		if (action === "add" || action === "remove" || action === "rm") {
			let target = args[1];
			if (!target) return message.SyntaxError();
			// @name gets resolved to the numeric id, plain ids pass through
			if (target.startsWith("@") || !/^\d+$/.test(target)) {
				try {
					const user = await api.rawClient.getUserByUsername(target.replace(/^@/, ""));
					if (!user) return message.reply("user not found");
					target = String(user.id || user.pk);
				}
				catch (err) {
					return message.reply(`couldn't resolve that user: ${err.message}`);
				}
			}
			target = String(target);
			if (action === "add") {
				if (wl.whiteListIds.includes(target)) return message.reply(`${target} is already whitelisted`);
				wl.whiteListIds.push(target);
				save();
				return message.reply(`${target} added to the whitelist`);
			}
			if (!wl.whiteListIds.includes(target)) return message.reply(`${target} is not in the whitelist`);
			wl.whiteListIds = wl.whiteListIds.filter((id) => id !== target);
			save();
			return message.reply(`${target} removed from the whitelist`);
		}

		return message.SyntaxError();
	}
};
