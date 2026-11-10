module.exports = {
	config: {
		name: "logsbot",
		version: "1.0.0",
		author: "xemonbae01",
		description: { en: "log thread changes to the console" },
		category: "events"
	},

	onEvent: async function ({ event }) {
		const allow = global.Anchestor.envEvents && global.Anchestor.envEvents.logsbot && global.Anchestor.envEvents.logsbot.allow;
		if (!allow) return;
		if (global.Anchestor.config.logEvents && global.Anchestor.config.logEvents.disableAll) return;
		const log = global.utils.log;
		if (event.changes && event.changes.title)
			log.info("LOGS", `thread ${event.threadID} title changed: "${event.changes.title.from}" -> "${event.changes.title.to}"`);
		if (event.changes && event.changes.themeId)
			log.info("LOGS", `thread ${event.threadID} theme changed`);
		if (Array.isArray(event.participantsAdded) && event.participantsAdded.length)
			log.info("LOGS", `thread ${event.threadID}: added ${event.participantsAdded.join(", ")}`);
		if (Array.isArray(event.participantsRemoved) && event.participantsRemoved.length)
			log.info("LOGS", `thread ${event.threadID}: removed ${event.participantsRemoved.join(", ")}`);
	}
};
