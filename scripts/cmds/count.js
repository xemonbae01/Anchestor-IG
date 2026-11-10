module.exports = {
	config: {
		name: "count",
		aliases: ["msgcount"],
		version: "1.0.0",
		author: "xemonbae01",
		countDown: 3,
		role: 0,
		description: { en: "your tracked message count" },
		category: "info",
		guide: { en: "   {pn}" }
	},

	onStart: async function ({ message, event, usersData, threadsData }) {
		const user = await usersData.get(event.senderID);
		const thread = await threadsData.get(event.threadID);
		const allUsers = await usersData.getAll();
		const total = allUsers.reduce((sum, u) => sum + (u.messageCount || 0), 0);
		return message.reply(
			`your messages tracked: ${user.messageCount || 0}` +
			`\nthis thread total: ${thread.messageCount || 0}` +
			`\nall threads total: ${total}` +
			`\nexp: ${user.exp || 0}`
		);
	}
};
