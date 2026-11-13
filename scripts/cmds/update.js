module.exports = {
	config: {
		name: "update",
		version: "1.0.0",
		author: "xemonbae01",
		countDown: 5,
		role: 2,
		description: { en: "check for bot updates, or update + restart now" },
		category: "admin",
		guide: { en: "   {pn} [check|now]\n   {pn} check — see if new code is out\n   {pn} now — update and restart into it" }
	},

	onStart: async function ({ message, args }) {
		const path = require('path');
		const root = path.join(__dirname, '..', '..');
		const autoUpdate = require('../../bot/login/autoUpdate');
		const updater = require('../../update');
		const sourceMod = require('../../update/source');
		const log = (global.utils && global.utils.log) || console;

		const want = (args[0] || 'check').toLowerCase();
		if (want !== 'check' && want !== 'now') return message.SyntaxError();

		const source = sourceMod.detectSource(root, {});
		const where = `${source.owner}/${source.repo}@${source.branch}`;

		if (want === 'check') {
			try {
				const check = await updater.checkForUpdates(root, {});
				if (check.upToDate) return message.reply(`up to date on ${where} — nothing to do.`);
				const p = check.plan;
				return message.reply(
					`update available on ${where}:\n` +
					`+${p.added.length} new, ~${p.updated.length} changed, -${p.deleted.length} removed` +
					(p.configNew.length ? `, ${p.configNew.length} config file(s) with new defaults (land as .new)` : '') +
					`\nrun -update now to apply it and restart.`
				);
			}
			catch (err) {
				return message.reply(`couldn't check for updates: ${err.message}`);
			}
		}

		// now: apply, then restart once the reply is out
		await message.reply(`updating from ${where}...`);
		try {
			const res = await autoUpdate.runUpdateOnce({ root, log, restart: false });
			if (res.upToDate) return message.reply('already up to date — nothing to do.');
			await message.reply(
				`updated: +${res.added} ~${res.updated} -${res.deleted}` +
				(res.configNew ? `, ${res.configNew} config .new to merge` : '') +
				(res.npmNeeded ? ' (deps reinstalled)' : '') +
				`. restarting...`
			);
			if (!autoUpdate.hasSupervisor()) {
				await message.reply('no supervisor found (not under pm2 / index.js) — restart the bot by hand to load the new code.');
				return;
			}
			await autoUpdate.shutdownForRestart(log);
			setTimeout(() => process.exit(2), 800);
		}
		catch (err) {
			return message.reply(`update failed: ${err.message} — nothing was restarted, try again later.`);
		}
	}
};
