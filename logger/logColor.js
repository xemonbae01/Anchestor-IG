'use strict';

// tiny ansi colors, no chalk needed
const wrap = (code) => (text) => `\x1b[${code}m${text}\x1b[0m`;

module.exports = {
	red: wrap(31),
	green: wrap(32),
	yellow: wrap(33),
	blue: wrap(34),
	magenta: wrap(35),
	cyan: wrap(36),
	gray: wrap(90),
	bold: wrap(1),
	hex: (_hex) => (text) => text // kept for api parity with the old logger, color name fallback
};
