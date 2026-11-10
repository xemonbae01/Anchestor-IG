module.exports = {
	config: {
		name: "eval",
		version: "1.0.0",
		author: "xemonbae01",
		countDown: 0,
		role: 2,
		description: { en: "run javascript (bot admin only)" },
		category: "admin",
		guide: { en: "   {pn} <code>" }
	},

	onStart: async function ({ message, event, args, api, threadsData, usersData, globalData }) {
		if (!args.length) return message.SyntaxError();
		const code = args.join(" ");
		try {
			// bot admin only command, this is meant to be raw
			let result = await eval(code);
			if (result === undefined) result = "undefined";
			else if (typeof result === "object") result = JSON.stringify(result, null, 2);
			else result = String(result);
			if (result.length > 1800) result = result.slice(0, 1800) + "\n... (truncated)";
			return message.reply(result);
		}
		catch (err) {
			return message.reply(`error: ${err.message}`);
		}
	}
};
