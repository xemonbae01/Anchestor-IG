'use strict';

// same shape the json store uses, one document per thread. nothing fancy,
// the controllers own the record shape — this just names the collection,
// the key and the indexes.
module.exports = {
	collection: 'threads',
	keyField: 'threadID',
	indexes: [
		{ keys: { threadID: 1 }, options: { unique: true } }
	],
	// default record, mirrors controller defaultRecord():
	// { threadID, threadName: null, isGroup: false, participantIDs: [],
	//   adminIDs: [], memberCount: 0, messageCount: 0, data: {},
	//   banned: { status: false, reason: null, date: null }, createdAt }
	defaults: {
		threadName: null,
		isGroup: false,
		participantIDs: [],
		adminIDs: [],
		memberCount: 0,
		messageCount: 0,
		data: {},
		banned: { status: false, reason: null, date: null }
	}
};
