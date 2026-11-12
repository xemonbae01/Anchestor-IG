'use strict';

// free-form key/value, one document per key: { _id: "<key>", value: <any> }.
// the key lives in _id so lookups are a plain _id match, no extra index.
module.exports = {
	collection: 'global',
	keyField: '_id',
	indexes: [],
	// no defaults — values are whatever the bot stored, any json type
	defaults: null
};
