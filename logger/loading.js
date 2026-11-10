'use strict';

const log = require('./log');

// no spinner lib, just plain lines. good enough
module.exports = {
	info: (text) => log.info('LOADING', text),
	success: (text) => log.success('LOADING', text),
	error: (text) => log.error('LOADING', text),
	warn: (text) => log.warn('LOADING', text)
};
