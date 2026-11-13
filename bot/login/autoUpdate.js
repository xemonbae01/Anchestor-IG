'use strict';

// bot/login/autoUpdate.js — watches the bot's own repo on GitHub (its fork,
// if that's what the folder was cloned from) and, when enabled, pulls new
// code and restarts the bot by itself — so nobody has to ssh in and update
// by hand. silent when there's nothing to do: no log line on a clean check,
// one line when it actually updates.
//
// config.json:
//   "update": {
//     "repo": "",    // "owner/name" to track — empty = git remote, then upstream
//     "branch": "",  // empty = current branch, then main
//     "auto": { "enabled": false, "intervalMinutes": 15 }
//   }
//
// env: ANCHESTOR_AUTO_UPDATE=1 forces it on (0 forces it off),
// ANCHESTOR_AUTO_UPDATE_INTERVAL overrides the minutes.
//
// it only runs when something can restart the bot: pm2 (pm_id is set) or
// the index.js spawner (ANCHESTOR_SPAWNED=1). without a supervisor an
// update would just kill the bot, so it refuses and says so once.

const path = require('path');

const updater = require('../../update');
const sourceMod = require('../../update/source');

const DEFAULT_INTERVAL_MINUTES = 15;
const MIN_INTERVAL_MINUTES = 5;
const FIRST_CHECK_DELAY_MS = 60 * 1000;
const SHUTDOWN_TIMEOUT_MS = 10 * 1000;

function hasSupervisor() {
	return Boolean(process.env.pm_id || process.env.ANCHESTOR_SPAWNED);
}

function resolveAutoConfig(config) {
	const upd = (config && config.update) || {};
	const auto = upd.auto || {};
	let enabled = auto.enabled === true;
	if (process.env.ANCHESTOR_AUTO_UPDATE === '1') enabled = true;
	if (process.env.ANCHESTOR_AUTO_UPDATE === '0') enabled = false;
	let minutes = Number(process.env.ANCHESTOR_AUTO_UPDATE_INTERVAL || auto.intervalMinutes || DEFAULT_INTERVAL_MINUTES);
	if (!Number.isFinite(minutes)) minutes = DEFAULT_INTERVAL_MINUTES;
	minutes = Math.max(MIN_INTERVAL_MINUTES, minutes);
	return { enabled, minutes };
}

// flush + disconnect before a restart, the same way a graceful shutdown
// does — process.exit(2) on its own would skip it and could lose the last
// few minutes of thread/user data. never hangs: 10s cap, then we go anyway.
async function shutdownForRestart(log) {
	const done = (async () => {
		try {
			if (global.Anchestor && typeof global.Anchestor.shutdown === 'function')
				await global.Anchestor.shutdown();
		} catch { /* disconnect is best effort here */ }
		try {
			const db = global.db || {};
			const flushes = [];
			for (const ctrl of [db.threadsData, db.usersData, db.globalData])
				if (ctrl && typeof ctrl._flush === 'function') flushes.push(ctrl._flush());
			await Promise.all(flushes);
			if (db.mongo && typeof db.mongo.close === 'function') {
				try { await db.mongo.close(); } catch { /* already gone */ }
			}
		} catch (err) {
			if (log) log.warn('UPDATE', `flush before restart failed: ${err.message}`);
		}
	})();
	await Promise.race([done, new Promise((r) => setTimeout(r, SHUTDOWN_TIMEOUT_MS))]);
}

// one full cycle: check GitHub, apply if there's anything new, restart into
// it. returns { upToDate, applied, source, plan, ...result }. restart=false
// applies without restarting (the -update command restarts on its own once
// its reply is out). updater/onRestart are injectable for tests.
async function runUpdateOnce({ root, log, restart = true, updater: updaterOverride, onRestart } = {}) {
	const up = updaterOverride || updater;
	const check = await up.checkForUpdates(root, {});
	if (check.upToDate) return { upToDate: true, applied: false, source: check.source, plan: check.plan };
	const changed = up.planChangedCount
		? up.planChangedCount(check.plan)
		: check.plan.added.length + check.plan.updated.length + check.plan.deleted.length + check.plan.configNew.length;
	if (log) log.info('UPDATE', `new code on ${check.source.owner}/${check.source.repo}@${check.source.branch} — ${changed} file(s), applying...`);
	const result = await up.applyUpdate(root, check, { log: (m) => { if (log) log.info('UPDATE', m); } });
	if (log) log.success('UPDATE', `updated: +${result.added} ~${result.updated} -${result.deleted}${result.configNew ? `, ${result.configNew} config .new to merge` : ''}${result.npmNeeded ? ' (npm install ran)' : ''}`);
	if (restart) {
		await shutdownForRestart(log);
		if (onRestart) onRestart();
		else process.exit(2);
	}
	return { upToDate: false, applied: true, source: check.source, plan: check.plan, ...result };
}

// starts the watcher. returns { stop, checkNow, config } or null when
// disabled / no supervisor. intervalMs and firstCheckDelayMs are test
// hooks — production uses the configured minutes.
function startAutoUpdate({ root, config, log, updater: updaterOverride, onRestart, intervalMs, firstCheckDelayMs } = {}) {
	const auto = resolveAutoConfig(config);
	if (!auto.enabled) return null;
	if (!hasSupervisor()) {
		if (log) log.warn('UPDATE', 'auto-update is on but nothing can restart the bot — run it with `node index.js` or under pm2');
		return null;
	}
	const rootDir = root || path.join(__dirname, '..', '..');
	const source = sourceMod.detectSource(rootDir, {});
	if (log) log.info('UPDATE', `auto-update on — watching ${source.owner}/${source.repo}@${source.branch}, every ${auto.minutes} min`);
	let running = false;
	let stopped = false;
	const tick = async () => {
		if (stopped || running) return;
		running = true;
		try {
			await runUpdateOnce({ root: rootDir, log, restart: true, updater: updaterOverride, onRestart });
			// up to date: say nothing, that's the silent part
		} catch (err) {
			if (log) log.warn('UPDATE', `auto-update check failed: ${err.message} — will retry`);
		} finally {
			running = false;
		}
	};
	const first = setTimeout(() => { tick(); }, firstCheckDelayMs !== undefined ? firstCheckDelayMs : FIRST_CHECK_DELAY_MS);
	const timer = setInterval(tick, intervalMs !== undefined ? intervalMs : auto.minutes * 60 * 1000);
	if (timer.unref) timer.unref();
	if (first.unref) first.unref();
	return {
		stop() { stopped = true; clearTimeout(first); clearInterval(timer); },
		checkNow: tick,
		config: auto
	};
}

module.exports = { startAutoUpdate, runUpdateOnce, shutdownForRestart, hasSupervisor, resolveAutoConfig };
