module.exports = {
	config: {
		name: "say",
		version: "1.0.0",
		author: "xemonbae01",
		countDown: 1,
		role: 0,
		description: { en: "make the bot say something" },
		category: "fun",
		guide: { en: "   {pn} <text>" }
	},

	onStart: async function ({ message, args }) {
		if (!args.length) return message.SyntaxError();
		return message.send(args.join(" "));
	}
};
