module.exports = {
	config: {
		name: "help",
		aliases: ["h", "menu"],
		version: "1.0.0",
		author: "xemonbae01",
		countDown: 3,
		role: 0,
		description: { en: "show all commands or info about one command" },
		category: "info",
		guide: { en: "   {pn} [command name]" }
	},

	langs: {
		en: {
			help: "『 anchestor 』\n%1",
			help2: "%1 commands total. type %2<command> for details",
			notFound: "command \"%1\" not found",
			detail: "『 %1 』\n%2\ncategory: %3\nrole: %4\ncooldown: %5s",
			role0: "everyone",
			role1: "group admin",
			role2: "bot admin"
		}
	},

	onStart: async function ({ message, args, prefix, getLang }) {
		const all = [...global.Anchestor.commands.values()];
		if (args[0]) {
			const name = global.Anchestor.aliases.get(args[0].toLowerCase()) || args[0].toLowerCase();
			const cmd = global.Anchestor.commands.get(name);
			if (!cmd) return message.reply(getLang("notFound", args[0]));
			const cfg = cmd.config;
			const desc = (cfg.description && (cfg.description.en || cfg.description)) || (cfg.longDescription && cfg.longDescription.en) || cfg.shortDescription || "";
			const roleText = cfg.role === 2 ? getLang("role2") : cfg.role === 1 ? getLang("role1") : getLang("role0");
			let text = getLang("detail", cfg.name, desc, cfg.category || "misc", roleText, cfg.countDown || 0);
			if (cfg.guide) text += `\nusage:\n${String(cfg.guide.en || cfg.guide).split("{pn}").join(prefix + cfg.name)}`;
			return message.reply(text);
		}
		const byCategory = {};
		for (const cmd of all) {
			const cat = cmd.config.category || "misc";
			(byCategory[cat] = byCategory[cat] || []).push(cmd.config.name);
		}
		let list = "";
		for (const cat of Object.keys(byCategory).sort())
			list += `\n[${cat}] ${byCategory[cat].sort().join(", ")}`;
		return message.reply(getLang("help", list.trim()) + "\n" + getLang("help2", all.length, prefix));
	}
};
