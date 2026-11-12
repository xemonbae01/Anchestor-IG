'use strict';

// same shape the json store uses, one document per user.
module.exports = {
	collection: 'users',
	keyField: 'userID',
	indexes: [
		{ keys: { userID: 1 }, options: { unique: true } }
	],
	// default record, mirrors controller defaultRecord():
	// { userID, name: null, username: null, data: {},
	//   banned: { status: false, reason: null, date: null },
	//   exp: 0, messageCount: 0, createdAt }
	defaults: {
		name: null,
		username: null,
		data: {},
		banned: { status: false, reason: null, date: null },
		exp: 0,
		messageCount: 0
	}
};
