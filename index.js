/**
 * @author xemonbae01
 * Developed By Redwan Ahemed https://GitHub.com/xemonbae01
 */

const { spawn } = require('child_process');
const path = require('path');

function startBot() {
	const child = spawn(process.execPath, [path.join(__dirname, 'Anchestor.js')], {
		cwd: __dirname,
		stdio: 'inherit',
		// tells the child a supervisor is watching, so the auto-updater
		// knows a restart will actually come back
		env: { ...process.env, ANCHESTOR_SPAWNED: '1' }
	});
	child.on('close', (code) => {
		if (code === 2) {
			console.log('[anchestor] restarting...');
			startBot();
		}
		else if (code !== 0 && code !== null) {
			console.log(`[anchestor] exited with code ${code}`);
		}
	});
	child.on('error', (err) => {
		console.error('[anchestor] failed to start:', err.message);
	});
}

startBot();
