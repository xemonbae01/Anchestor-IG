'use strict';

// update/source.js — figures out which GitHub repo to update from, so forks
// just work without anyone editing code:
//
//   1. an explicit repo — config.json `update.repo` ("owner/name"),
//      --repo on the command line, or ANCHESTOR_UPDATE_REPO
//   2. the git remote of the bot folder (`git remote get-url origin`)
//   3. the upstream default (xemonbae01/Anchestor-IG)
//
// same order for the branch: explicit > checked-out git branch > main.
// no git, no config, no problem — it always lands on the upstream default.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const DEFAULT_OWNER = 'xemonbae01';
const DEFAULT_REPO = 'Anchestor-IG';
const DEFAULT_BRANCH = 'main';

function parseGitHubRemote(url) {
	if (!url || typeof url !== 'string') return null;
	const trimmed = url.trim();
	const patterns = [
		/^https?:\/\/github\.com\/([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/,
		/^git@github\.com:([^/\s]+)\/([^/\s]+?)(?:\.git)?$/,
		/^ssh:\/\/git@github\.com\/([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/,
		/^git:\/\/github\.com\/([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/
	];
	for (const re of patterns) {
		const m = trimmed.match(re);
		if (m) return { owner: m[1], repo: m[2] };
	}
	return null;
}

// one git call, never throws, never hangs — returns stdout or null
function gitOutput(root, args) {
	try {
		const res = spawnSync('git', ['-C', root, ...args], {
			encoding: 'utf8',
			timeout: 10000,
			stdio: ['ignore', 'pipe', 'ignore']
		});
		if (!res || res.status !== 0) return null;
		const out = (res.stdout || '').trim();
		return out || null;
	}
	catch { return null; }
}

function readUpdateConfig(root) {
	try {
		const file = path.join(root, 'config.json');
		if (!fs.existsSync(file)) return {};
		const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
		return (cfg && typeof cfg.update === 'object' && cfg.update) || {};
	}
	catch { return {}; }
}

function detectSource(root, overrides = {}) {
	const cfg = readUpdateConfig(root);
	const repoStr = overrides.repo || process.env.ANCHESTOR_UPDATE_REPO || cfg.repo || '';
	const branchOverride = overrides.branch || process.env.ANCHESTOR_UPDATE_BRANCH || cfg.branch || '';

	let owner = DEFAULT_OWNER;
	let repo = DEFAULT_REPO;
	let from = 'default';
	const m = String(repoStr).trim().match(/^([^/\s]+)\/([^/\s]+)$/);
	if (m) {
		owner = m[1];
		repo = m[2].replace(/\.git$/, '');
		from = 'config';
	} else {
		const remote = gitOutput(root, ['remote', 'get-url', 'origin']);
		const parsed = remote && parseGitHubRemote(remote);
		if (parsed) {
			owner = parsed.owner;
			repo = parsed.repo;
			from = 'git';
		}
	}

	let branch = branchOverride;
	let branchFrom = branchOverride ? 'config' : 'default';
	if (!branch) {
		const current = gitOutput(root, ['rev-parse', '--abbrev-ref', 'HEAD']);
		if (current && current !== 'HEAD') {
			branch = current;
			branchFrom = 'git';
		}
	}
	if (!branch) branch = DEFAULT_BRANCH;

	return { owner, repo, branch, from, branchFrom };
}

module.exports = {
	DEFAULT_OWNER,
	DEFAULT_REPO,
	DEFAULT_BRANCH,
	parseGitHubRemote,
	readUpdateConfig,
	detectSource
};
