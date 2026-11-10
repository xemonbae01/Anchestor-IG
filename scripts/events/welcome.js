module.exports = {
	config: {
		name: "welcome",
		version: "1.0.0",
		author: "xemonbae01",
		description: { en: "greet new people in group threads" },
		category: "events"
	},

	onEvent: async function ({ message, event, threadsData }) {
		const added = event.participantsAdded || event.addedParticipants || [];
		if (!added.length || !event.isGroup) return;
		// can be turned off per thread with data.welcome = false
		const enabled = await threadsData.get(event.threadID, "data.welcome");
		if (enabled === false) return;
		const names = added.map((p) => {
			if (typeof p === "string") return p;
			return p.username ? `@${p.username}` : String(p.id || p);
		});
		await message.send(`welcome ${names.join(", ")} 👋\ntype ${global.utils.getPrefix(event.threadID)}help to see what i can do`);
	}
};
