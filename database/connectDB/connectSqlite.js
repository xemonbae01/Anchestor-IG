'use strict';

// sqlite isn't wired in this build, json is the default store.
module.exports = async function connectSqlite() {
	throw new Error('database.type "sqlite" is not wired in this build, use type: "json" in config.json');
};
