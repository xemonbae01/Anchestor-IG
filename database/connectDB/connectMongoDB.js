'use strict';

// mongodb isn't wired in this build, json is the default store.
// kept so the layout matches config database.type options.
module.exports = async function connectMongoDB() {
	throw new Error('database.type "mongodb" is not wired in this build, use type: "json" in config.json');
};
