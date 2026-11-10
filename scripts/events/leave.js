module.exports = {
	config: {
		name: "leave",
		version: "1.0.0",
		author: "xemonbae01",
		description: { en: "say bye when someone leaves a group thread" },
		category: "events"
	},

	onEvent: async function ({ message, event, threadsData }) {
		const removed = event.participantsRemoved || event.removedParticipants || [];
		if (!removed.length || !event.isGroup) return;
		const enabled = await threadsData.get(event.threadID, "data.welcome");
		if (enabled === false) return;
		const names = removed.map((p) => {
			if (typeof p === "string") return p;
			return p.username ? `@${p.username}` : String(p.id || p);
		});
		// don't say bye to the bot itself
		const botID = String(global.Anchestor.botID || "");
		if (names.length === 1 && names[0] === botID) return;
		await message.send(`${names.join(", ")} left the thread. bye 👋`);
	}
};
