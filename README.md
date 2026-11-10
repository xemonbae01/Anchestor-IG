# anchestor — Instagram Bot

An Instagram DM bot built on a well known architecture — modular commands and events,
a json database that works with zero setup, hot-reloadable config, per-thread prefixes,
cooldowns, role gates and reply/reaction chains.

Developed by **xemonbae01** (Redwan Ahemed) — https://github.com/xemonbae01

## Features

- Command system with aliases, categories, cooldowns and role levels (0 everyone, 1 group admin, 2 bot admin)
- Event system for thread updates — welcomes, goodbyes, thread info sync, console logging
- Per-thread prefix (changeable in chat, with reaction confirmation), global prefix for bot admins
- `onChat`, `onReply` and `onReaction` hooks so commands can hold conversations
- Zero-config json database (threads / users / global), atomic debounced writes
- Works in DMs and group threads, admin-only mode and whitelist modes included
- Bundled `ig-chat-api` client — polling based, no browser automation, no official API token needed

## Requirements

- Node.js 18 or newer
- An Instagram account (use a spare one, automation always carries some risk)

## Quick start

```bash
npm install
```

### 1. Get your session

The bot logs in with your Instagram web session cookies — no password is stored anywhere.

1. Open [instagram.com](https://www.instagram.com) in your browser and log in.
2. Open DevTools → Application → Cookies → `https://www.instagram.com`.
3. Copy the values of `sessionid`, `csrftoken` and `ds_user_id`.
4. Create `data/session.json` (see `data/session.json.example`):

```json
{
  "cookies": {
    "sessionid": "your sessionid",
    "csrftoken": "your csrftoken",
    "ds_user_id": "your numeric user id"
  }
}
```

Alternatives:

- Put the same JSON in `account.txt` in the project root (also git-ignored).
- Or use environment variables: `IG_COOKIE_STRING` (a raw `sessionid=...; csrftoken=...; ds_user_id=...` string), or `IG_SESSION_ID` + `IG_CSRF_TOKEN` + `IG_USER_ID`. `IG_SESSION_PATH` overrides the session file location.

### 2. Configure

Edit `config.json`:

- `prefix` — default command prefix (`-`)
- `adminBot` — array with **your Instagram numeric user id** (the `ds_user_id`), so admin commands work for you
- `instagram.pollIntervalMs` — how often new messages are polled

### 3. Run

```bash
node index.js
# or
npm start
```

`index.js` runs the bot as a child process and restarts it when it exits with code 2
(that's what the `-restart` command uses).

Then DM the account from another account and send `-help`.

## Commands

Default prefix is `-`. Type just `prefix` in a chat to see the current one.

| Command | Description |
| --- | --- |
| `help [command]` | list commands or show one in detail |
| `ping` | latency + uptime check |
| `uid` | your id, or the replied user's id |
| `userinfo [@user]` | profile + friendship info |
| `threadinfo` | this thread's info, members and nicknames |
| `uptime` | how long the bot has been running |
| `count` | your tracked message count |
| `prefix <p> / reset / <p> -g` | change prefix (reaction confirm) |
| `admin list/add/remove` | manage bot admins |
| `say <text>` | make the bot say something |
| `nickname <name>` | set/clear nicknames in this thread |
| `theme list/set/reset` | chat themes |
| `note [post <text> / mine / delete]` | Instagram notes |
| `poll <q> \| <a> \| <b>` | create a poll |
| `unsend` | unsend a bot message (reply to it) |
| `gif <query>` | search and send a gif |
| `inbox` | latest conversations (bot admin) |
| `follow [follow/unfollow] @user` | friendship status / follow / unfollow |
| `cmd load/unload/reload <name>` | manage command files at runtime (bot admin) |
| `restart` | restart the bot (bot admin) |
| `eval <code>` | run js (bot admin only) |

## Project structure

```
anchestor/
├── index.js                  # spawns Anchestor.js, restarts on exit code 2
├── Anchestor.js              # core init: globals, config watch, auto restart
├── config.json               # main config
├── configCommands.json       # per-command env, banned commands, unload lists
├── configIgApi.json          # ig-chat-api client options
├── utils.js
├── logger/                   # log, logColor, loading
├── languages/                # en.lang, vi.lang, makeFuncGetLangs.js
├── bot/
│   ├── login/                # login.js (session + api facade), loadData, loadScripts
│   └── handler/              # handlerEvents (dispatch), handlerAction (message obj), handlerCheckData
├── database/
│   ├── connectDB/            # json store (+ mongo/sqlite stubs)
│   ├── controller/           # threadsData, usersData, globalData
│   ├── models/
│   └── data/                 # threads.json, users.json, global.json
├── ig-chat-api/              # bundled Instagram chat client (see Credits)
├── scripts/
│   ├── cmds/                 # commands
│   └── events/               # events
└── data/
    └── session.json.example
```

## Configuration

`config.json` — prefix, bot admins, admin-only mode, whitelists, timezone, database type
(`json` is the one wired up), auto restart, log toggles and the `instagram` section
(session path, poll interval, debug).

`configCommands.json` — `envGlobal` / `envCommands` / `envEvents` for per-script settings
(e.g. `envEvents.logsbot.allow`), `commandBanned` per thread, and `commandUnload` /
`commandEventUnload` lists for scripts that shouldn't load.

Both files are watched and hot-reloaded while the bot runs.

## Adding a command

Drop a file in `scripts/cmds/`:

```js
module.exports = {
	config: {
		name: "hello",
		version: "1.0.0",
		author: "xemonbae01",
		countDown: 3,
		role: 0, // 0 everyone, 1 group admin, 2 bot admin
		description: { en: "say hello" },
		category: "fun",
		guide: { en: "   {pn} [name]" }
	},

	onStart: async function ({ message, event, args }) {
		return message.reply(`hello ${args[0] || event.senderName || "there"}`);
	}
};
```

Commands get `{ api, message, event, args, threadsData, usersData, globalData, commandName, getLang, role, prefix }`.
Optional hooks: `onChat` (runs on every message, return `true` if handled), `onReply`
(fires when someone replies to a message you registered in `global.Anchestor.onReply`),
and `onReaction` (same idea with `global.Anchestor.onReaction`, keyed by messageID).
Events live in `scripts/events/` with `onEvent` / `onStart` — files ending in `.eg.js`
are examples and never load.

The database API uses path strings: `await threadsData.get(threadID, "data.prefix")`,
`await threadsData.set(threadID, "!", "data.prefix")`, same shape for `usersData`,
and `globalData.get(key)` / `globalData.set(key, value)` for free-form values.

Commands talk Instagram through the `api` facade (`api.sendMessage`, `api.getThreadInfo`,
`api.getUserInfo`, `api.setMessageReaction`, `api.unsendMessage`, `api.changeNickname`,
`api.changeThreadTitle`) — or grab `api.rawClient` for the full ig-chat-api surface
(notes, polls, themes, gifs, follow, inbox and more).

## Security notes

- `data/session.json`, `account.txt`, `*.session.json` and `.env` are git-ignored — never commit your session. A session cookie is as good as being logged in.
- Sessions expire. If the bot starts failing with auth errors, grab fresh cookies and update the file.
- `-eval` and `-cmd` are bot-admin only for a reason. Keep `adminBot` limited to yourself.

## Credits

- **ig-chat-api** (in `ig-chat-api/`) is based on **instagram-chat-api by JARiF (jarif098)** — https://github.com/jarif098/instagram-chat-api — MIT licensed, license kept in `ig-chat-api/LICENSE`.
- anchestor itself is developed by **xemonbae01**.

## License

MIT
