module.exports = {
	config: {
		name: "cmd",
		version: "1.1.0",
		author: "xemonbae01",
		countDown: 0,
		role: 2,
		description: { en: "load / unload / reload command files at runtime, see registry collisions" },
		category: "admin",
		guide: { en: "   {pn} load <name>" +
			"\n   {pn} unload <name or alias>" +
			"\n   {pn} reload <name>" +
			"\n   {pn} reloadall" +
			"\n   {pn} collisions" }
	},

	onStart: async function ({ message, args, api }) {
		const loadScripts = require("../../bot/login/loadScripts");
		const action = (args[0] || "").toLowerCase();
		const name = (args[1] || "").toLowerCase();

		if (action === "collisions") {
			const report = loadScripts.getRegistryReport();
			const lines = [`registry: ${report.commands.length} command files, ${report.events.length} event files`];
			const shadowed = report.commands.filter((c) => c.shadowed);
			for (const c of shadowed)
				lines.push(c.dormant
					? `dormant: ${c.name} (${c.file}) — name taken, no free alias`
					: `shadowed: ${c.name} (${c.file}) — reachable as ${c.key}`);
			if (!report.collisions.length && !shadowed.length) lines.push("no collisions, clean registry");
			for (const col of report.collisions)
				lines.push(`collision: ${col.type} "${col.key}" — ${col.winner} won, ${col.loser} lost`);
			return message.reply(lines.join("\n"));
		}

		if (action === "reloadall") {
			try {
				const counts = await loadScripts(api);
				return message.reply(`reloaded everything: ${counts.commands} commands, ${counts.events} events (${counts.shadowed} shadowed, ${counts.dormant} dormant)`);
			}
			catch (err) {
				return message.reply(`failed: ${err.message}`);
			}
		}

		if (!name || !["load", "unload", "reload"].includes(action)) return message.SyntaxError();
		try {
			if (action === "load") {
				loadScripts.loadCommand(name);
				return message.reply(`command "${name}" loaded`);
			}
			if (action === "unload") {
				const removed = loadScripts.unloadCommand(name);
				return message.reply(`command "${removed}" unloaded`);
			}
			loadScripts.reloadCommand(name);
			return message.reply(`command "${name}" reloaded`);
		}
		catch (err) {
			return message.reply(`failed: ${err.message}`);
		}
	}
};
