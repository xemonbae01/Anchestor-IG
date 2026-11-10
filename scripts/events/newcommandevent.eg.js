// example event file — files ending in .eg.js are never loaded by the bot.
// copy this, rename it to something like myevent.js and it will run.
module.exports = {
	config: {
		name: "newcommandevent",
		version: "1.0.0",
		author: "xemonbae01",
		description: { en: "example event" },
		category: "events"
	},

	onEvent: async function ({ event }) {
		console.log("got a thread event:", event.threadID);
	}
};
