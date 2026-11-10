module.exports = {
	config: {
		name: "autoUpdateInfoThread",
		version: "1.0.0",
		author: "xemonbae01",
		description: { en: "keep cached thread info fresh on thread updates" },
		category: "events"
	},

	// runs on any event, the actual refresh only happens for thread updates
	onStart: async function ({ event, threadsData }) {
		if (event.type !== "event" && event.type !== "thread_update") return;
		const patch = {};
		if (event.threadName) patch.threadName = event.threadName;
		if (event.changes && event.changes.title && event.changes.title.to) patch.threadName = event.changes.title.to;
		if (Array.isArray(event.participantIDs) && event.participantIDs.length) {
			patch.participantIDs = event.participantIDs.map(String);
			patch.memberCount = event.participantIDs.length;
		}
		if (event.isGroup !== undefined) patch.isGroup = !!event.isGroup;
		if (Object.keys(patch).length) await threadsData.set(event.threadID, patch);
	}
};
