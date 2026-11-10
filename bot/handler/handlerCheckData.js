'use strict';

// makes sure thread/user records exist and keeps the counters moving
async function handlerCheckData({ event, threadsData, usersData }) {
	const threadID = event.threadID ? String(event.threadID) : null;
	const senderID = event.senderID ? String(event.senderID) : null;

	if (threadID) {
		const thread = await threadsData.get(threadID);
		const patch = {};
		if (event.isGroup !== undefined && thread.isGroup !== !!event.isGroup) patch.isGroup = !!event.isGroup;
		if (Array.isArray(event.participantIDs) && event.participantIDs.length) {
			patch.participantIDs = event.participantIDs.map(String);
			patch.memberCount = event.participantIDs.length;
		}
		if (event.threadName && thread.threadName !== event.threadName) patch.threadName = event.threadName;
		if (Array.isArray(event.adminIDs) && event.adminIDs.length) patch.adminIDs = event.adminIDs.map(String);
		if (event.type === 'message') patch.messageCount = (thread.messageCount || 0) + 1;
		if (Object.keys(patch).length) await threadsData.set(threadID, patch);
	}

	if (senderID) {
		const user = await usersData.get(senderID);
		const patch = {};
		if (event.senderName && user.name !== event.senderName) patch.name = event.senderName;
		if (event.senderUsername && user.username !== event.senderUsername) patch.username = event.senderUsername;
		if (event.type === 'message') {
			patch.messageCount = (user.messageCount || 0) + 1;
			patch.exp = (user.exp || 0) + 1;
		}
		if (Object.keys(patch).length) await usersData.set(senderID, patch);
	}
}

// role: 2 bot admin, 1 group admin, 0 everyone
// ig has no real thread admins in dms, group admins come from the thread payload
function getRole(threadData, senderID) {
	const config = (global.Anchestor && global.Anchestor.config) || {};
	const admins = (config.adminBot || []).map(String);
	// admins added at runtime with -admin live in globalData
	try {
		const extra = global.db && global.db.globalData ? global.db.globalData.peek('adminBot') : null;
		if (Array.isArray(extra)) for (const id of extra) if (!admins.includes(String(id))) admins.push(String(id));
	} catch { /* ignore */ }
	if (admins.includes(String(senderID))) return 2;
	if (threadData && Array.isArray(threadData.adminIDs) && threadData.adminIDs.map(String).includes(String(senderID))) return 1;
	return 0;
}

module.exports = handlerCheckData;
module.exports.handlerCheckData = handlerCheckData;
module.exports.getRole = getRole;
