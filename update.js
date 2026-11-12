#!/usr/bin/env node
'use strict';

// update.js — pull just the changed files from GitHub, no clone, no reinstall.
//
//   node update.js               plan + confirm, then apply
//   node update.js --dry-run     show what would change, touch nothing
//   node update.js --force       skip the confirmation prompt
//   node update.js --branch dev  update from another branch
//   node update.js --restart     also `pm2 restart anchestor` at the end
//
// how it works: fetch the remote git tree, compare every file's git blob sha
// (sha1 of "blob <len>\0<bytes>") against the local copy, download only what
// changed. package.json changing is the only thing that triggers `npm install`.
// your session, data and config are never touched — see PROTECTED below.
// update.js itself is updatable too (replacing a running script is fine,
// node already loaded it into memory).

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const readline = require('readline');
const { spawnSync } = require('child_process');

const OWNER = 'xemonbae01';
const REPO = 'Anchestor-IG';
const DEFAULT_BRANCH = 'main';
const MANIFEST_FILE = '.update-manifest.json';
const BACKUP_DIR = 'update-backup';
const MAX_LIST = 50;

// never overwritten, never deleted, never backed up over
const PROTECTED = [
	'account.txt',
	'config.json',
	'configCommands.json',
	'configIgApi.json',
	'.env',
	'.update-manifest.json'
];
const PROTECTED_DIRS = ['data', 'database/data', 'downloads', 'node_modules', 'update-backup', '.git'];
// a changed config file gets downloaded as <file>.new next to it instead,
// so you can merge the new bits in by hand
const CONFIG_FILES = ['config.json', 'configCommands.json', 'configIgApi.json'];
// data/session.json.example is a doc file, not your session — safe to update
const PROTECTED_EXCEPTIONS = ['data/session.json.example'];

function isProtected(rel) {
	const p = rel.replace(/\\/g, '/');
	if (PROTECTED_EXCEPTIONS.includes(p)) return false;
	if (PROTECTED.includes(p)) return true;
	return PROTECTED_DIRS.some((d) => p === d || p.startsWith(d + '/'));
}

function blobSha(buf) {
	const head = Buffer.from(`blob ${buf.length}\0`, 'utf8');
	return crypto.createHash('sha1').update(head).update(buf).digest('hex');
}

function token() {
	return process.env.GH_TOKEN || process.env.GITHUB_TOKEN || null;
}

function httpsGet(url, { binary = false, headers = {} } = {}, redirects = 3) {
	return new Promise((resolve, reject) => {
		const req = https.get(url, {
			headers: {
				'User-Agent': 'anchestor-updater',
				...headers
			}
		}, (res) => {
			if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) {
				res.resume();
				return resolve(httpsGet(res.headers.location, { binary, headers }, redirects - 1));
			}
			const chunks = [];
			res.on('data', (c) => chunks.push(c));
			res.on('end', () => {
				const buf = Buffer.concat(chunks);
				if (res.statusCode < 200 || res.statusCode >= 300) {
					const err = new Error(`HTTP ${res.statusCode} from ${url}`);
					err.status = res.statusCode;
					err.body = buf.toString('utf8').slice(0, 300);
					return reject(err);
				}
				resolve(binary ? buf : buf.toString('utf8'));
			});
		});
		req.on('error', reject);
		req.setTimeout(30000, () => req.destroy(new Error(`timed out fetching ${url}`)));
	});
}

async function fetchTree(branch) {
	const url = `https://api.github.com/repos/${OWNER}/${REPO}/git/trees/${encodeURIComponent(branch)}?recursive=1`;
	const headers = { Accept: 'application/vnd.github+json' };
	const tk = token();
	if (tk) headers.Authorization = `Bearer ${tk}`;
	let text;
	try {
		text = await httpsGet(url, { headers });
	}
	catch (err) {
		if (err.status === 403 && /rate limit/i.test(err.body || ''))
			throw new Error('GitHub API rate limit hit (60/hr without a token) — set GH_TOKEN and try again, or wait a bit');
		if (err.status === 404)
			throw new Error(`branch "${branch}" not found on ${OWNER}/${REPO}`);
		throw err;
	}
	const data = JSON.parse(text);
	if (data.truncated)
		throw new Error('remote tree is truncated, refusing to guess — update by hand this time');
	const files = {};
	for (const entry of data.tree || []) {
		if (entry.type === 'blob') files[entry.path] = entry.sha;
	}
	return { headSha: data.sha, files };
}

function readManifest(root) {
	const file = path.join(root, MANIFEST_FILE);
	try {
		if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
	}
	catch { /* corrupt manifest, treat as no manifest */ }
	return null;
}

function writeManifest(root, branch, headSha, files) {
	fs.writeFileSync(
		path.join(root, MANIFEST_FILE),
		JSON.stringify({ branch, headSha, files }, null, 2) + '\n',
		'utf8'
	);
}

// figure out what needs doing without touching anything
function buildPlan(root, remoteFiles, manifest) {
	const plan = { added: [], updated: [], deleted: [], configNew: [], skipped: [], unchanged: 0 };
	for (const [rel, sha] of Object.entries(remoteFiles)) {
		const local = path.join(root, rel);
		if (isProtected(rel)) {
			// config files: offer a .new copy when upstream moved on
			if (CONFIG_FILES.includes(rel)) {
				const newPath = local + '.new';
				if (fs.existsSync(newPath) && blobSha(fs.readFileSync(newPath)) === sha) {
					plan.unchanged++;
				} else if (!fs.existsSync(local) || blobSha(fs.readFileSync(local)) !== sha) {
					plan.configNew.push(rel);
				} else {
					plan.unchanged++;
				}
			} else {
				plan.skipped.push(rel);
			}
			continue;
		}
		if (!fs.existsSync(local)) {
			plan.added.push(rel);
		} else if (blobSha(fs.readFileSync(local)) !== sha) {
			plan.updated.push(rel);
		} else {
			plan.unchanged++;
		}
	}
	// deletions only for files we previously tracked — unknown local files
	// are never deleted, and a first run (no manifest) deletes nothing
	if (manifest && manifest.files) {
		for (const rel of Object.keys(manifest.files)) {
			if (remoteFiles[rel]) continue;
			if (isProtected(rel)) continue;
			if (fs.existsSync(path.join(root, rel))) plan.deleted.push(rel);
		}
	}
	for (const key of ['added', 'updated', 'deleted', 'configNew', 'skipped']) plan[key].sort();
	return plan;
}

function planHasWork(plan) {
	return plan.added.length || plan.updated.length || plan.deleted.length || plan.configNew.length;
}

function printPlan(plan) {
	const show = (label, list) => {
		if (!list.length) return;
		console.log(`  ${label} (${list.length}):`);
		for (const rel of list.slice(0, MAX_LIST)) console.log(`    ${rel}`);
		if (list.length > MAX_LIST) console.log(`    ...and ${list.length - MAX_LIST} more`);
	};
	console.log('update plan:');
	show('add', plan.added);
	show('update', plan.updated);
	show('delete', plan.deleted);
	show('new config (as .new, merge by hand)', plan.configNew);
	if (plan.skipped.length) console.log(`  skipped (protected): ${plan.skipped.length} file(s) — account.txt, data, downloads, your config`);
	console.log(`  unchanged: ${plan.unchanged}`);
}

async function confirm() {
	if (!process.stdin.isTTY)
		throw new Error('not a terminal — run with --force to apply without a prompt');
	const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
	const answer = await new Promise((resolve) => rl.question('apply? [y/N] ', resolve));
	rl.close();
	return /^y(es)?$/i.test(answer.trim());
}

async function downloadVerified(branch, rel, wantSha) {
	const url = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${encodeURIComponent(branch)}/${rel}`;
	for (let attempt = 1; attempt <= 2; attempt++) {
		const buf = await httpsGet(url, { binary: true });
		if (blobSha(buf) === wantSha) return buf;
		if (attempt === 2)
			throw new Error(`downloaded ${rel} doesn't match its git sha (tried twice) — aborting, nothing was applied yet for this file`);
	}
}

function backupFile(root, backupDir, rel) {
	const src = path.join(root, rel);
	if (!fs.existsSync(src)) return;
	const dest = path.join(backupDir, rel);
	fs.mkdirSync(path.dirname(dest), { recursive: true });
	fs.copyFileSync(src, dest);
}

function writeFile(root, rel, buf) {
	const dest = path.join(root, rel);
	fs.mkdirSync(path.dirname(dest), { recursive: true });
	fs.writeFileSync(dest, buf);
}

function runNpmInstall(root) {
	console.log('package.json changed — running npm install --omit=dev ...');
	const res = spawnSync('npm', ['install', '--omit=dev'], {
		cwd: root,
		stdio: 'inherit',
		shell: process.platform === 'win32'
	});
	if (res.error) throw new Error(`npm install failed to start: ${res.error.message}`);
	if (res.status !== 0) throw new Error(`npm install exited with code ${res.status} — files were updated but dependencies may be stale`);
}

function tryPm2Restart() {
	const res = spawnSync('pm2', ['restart', 'anchestor'], { stdio: 'inherit', shell: process.platform === 'win32' });
	if (res.error && res.error.code === 'ENOENT') {
		console.log('pm2 not found — restart the bot by hand: node index.js');
		return;
	}
	if (res.status !== 0) console.log('pm2 restart exited non-zero — check `pm2 status`');
}

function parseArgs(argv) {
	const opts = { branch: DEFAULT_BRANCH, force: false, dryRun: false, noBackup: false, restart: false, root: process.env.ANCHESTOR_ROOT || null };
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === '--dry-run') opts.dryRun = true;
		else if (arg === '--force') opts.force = true;
		else if (arg === '--no-backup') opts.noBackup = true;
		else if (arg === '--restart') opts.restart = true;
		else if (arg === '--branch') opts.branch = argv[++i] || opts.branch;
		else if (arg === '--root') opts.root = argv[++i] || opts.root;
		else if (arg === '--help' || arg === '-h') opts.help = true;
		else throw new Error(`unknown flag: ${arg} (see --help)`);
	}
	return opts;
}

function usage() {
	console.log([
		'usage: node update.js [--dry-run] [--force] [--no-backup] [--restart] [--branch <name>] [--root <dir>]',
		'',
		'  --dry-run   show what would change, write nothing',
		'  --force     skip the confirmation prompt',
		'  --no-backup don\'t copy replaced files into update-backup/',
		'  --restart   pm2 restart anchestor after a successful update',
		'  --branch    update from a branch other than main',
		'  --root      bot directory (default: this script\'s folder, or ANCHESTOR_ROOT)',
		'',
		'protected (never touched): account.txt, data/, database/data/, downloads/,',
		'config.json, configCommands.json, configIgApi.json, .env, node_modules/',
		'changed config files land as <file>.new for you to merge by hand.'
	].join('\n'));
}

async function main(argv) {
	const opts = parseArgs(argv);
	if (opts.help) {
		usage();
		return 0;
	}
	const root = path.resolve(opts.root || __dirname);
	console.log(`anchestor updater — ${OWNER}/${REPO}@${opts.branch} → ${root}`);

	const { headSha, files: remoteFiles } = await fetchTree(opts.branch);
	const manifest = readManifest(root);
	const plan = buildPlan(root, remoteFiles, manifest);

	if (!planHasWork(plan)) {
		console.log('already up to date — nothing to do.');
		return 0;
	}
	printPlan(plan);

	if (opts.dryRun) {
		console.log('dry run — nothing was written.');
		return 0;
	}

	if (!opts.force && !(await confirm())) {
		console.log('aborted, nothing changed.');
		return 0;
	}

	let backupDir = null;
	if (!opts.noBackup) {
		const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
		backupDir = path.join(root, BACKUP_DIR, stamp);
		fs.mkdirSync(backupDir, { recursive: true });
	}

	// download + verify everything BEFORE writing anything, so a bad
	// download can't leave the bot half-updated
	const downloads = [];
	for (const rel of [...plan.added, ...plan.updated])
		downloads.push([rel, await downloadVerified(opts.branch, rel, remoteFiles[rel])]);
	const configDownloads = [];
	for (const rel of plan.configNew)
		configDownloads.push([rel, await downloadVerified(opts.branch, rel, remoteFiles[rel])]);

	if (backupDir) {
		for (const rel of [...plan.updated, ...plan.deleted]) backupFile(root, backupDir, rel);
	}

	for (const [rel, buf] of downloads) writeFile(root, rel, buf);
	for (const [rel, buf] of configDownloads) writeFile(root, rel + '.new', buf);
	for (const rel of plan.deleted) fs.unlinkSync(path.join(root, rel));

	writeManifest(root, opts.branch, headSha, remoteFiles);

	const npmNeeded = plan.added.includes('package.json') || plan.updated.includes('package.json');
	// ig-chat-api/package.json changing alone never triggers npm install —
	// its only dependency (axios) already lives in the root package.json
	if (npmNeeded) runNpmInstall(root);

	console.log('\nupdate done:');
	console.log(`  added ${plan.added.length}, updated ${plan.updated.length}, deleted ${plan.deleted.length}, config .new ${plan.configNew.length}, skipped ${plan.skipped.length}`);
	if (backupDir) console.log(`  backup: ${path.relative(root, backupDir)}/`);
	if (plan.configNew.length) console.log(`  merge ${plan.configNew.map((f) => f + '.new').join(', ')} into your config by hand`);
	console.log(npmNeeded ? '  npm install ran (package.json changed)' : '  npm install skipped (package.json unchanged)');
	if (opts.restart) tryPm2Restart();
	else console.log('  restart the bot: node index.js (or pm2 restart anchestor)');
	return 0;
}

if (require.main === module) {
	main(process.argv.slice(2)).then(
		(code) => process.exit(code),
		(err) => {
			console.error(`update failed: ${err.message}`);
			process.exit(1);
		}
	);
}

module.exports = { main, buildPlan, blobSha, isProtected, fetchTree };
