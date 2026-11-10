module.exports = {
	config: {
		name: "poll",
		version: "1.0.0",
		author: "xemonbae01",
		countDown: 5,
		role: 0,
		description: { en: "create a poll in this thread" },
		category: "group",
		guide: { en: "   {pn} <question> | <option 1> | <option 2> [| more options]" }
	},

	onStart: async function ({ message, event, args, api }) {
		const client = api.rawClient;
		if (!client) return message.reply("ig client not available");
		const raw = args.join(" ");
		const parts = raw.split("|").map((s) => s.trim()).filter(Boolean);
		if (parts.length < 3) return message.SyntaxError();
		const [question, ...options] = parts;
		try {
			await client.createPoll(event.threadID, question, options.slice(0, 4));
			return message.reply(`poll created: ${question}`);
		}
		catch (err) {
			return message.reply(`failed to create poll: ${err.message}`);
		}
	}
};
