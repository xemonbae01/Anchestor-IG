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
2. Export the cookies with a browser extension like Cookie-Editor — JSON export
   works, Netscape export works, or just copy the three values by hand.
3. Paste them into **`account.txt`** in the project root. Any of these shapes work:

```json
// Cookie-Editor JSON export — paste the array as-is, extra fields ignored
[
  { "name": "sessionid", "value": "..." },
  { "name": "csrftoken", "value": "..." },
  { "name": "ds_user_id", "value": "..." }
]
```

```json
// or just the three cookies that matter
{
  "cookies": {
    "sessionid": "your sessionid",
    "csrftoken": "your csrftoken",
    "ds_user_id": "your numeric user id"
  }
}
```

Only `sessionid`, `csrftoken` and `ds_user_id` are needed — the rest of the
export (`datr`, `mid`, `ig_did`, …) is ignored. The Netscape text format
(`#HttpOnly_.instagram.com … sessionid …`) and a raw cookie string
(`sessionid=...; csrftoken=...; ds_user_id=...`) work too.

You don't have to re-paste your cookies: the bot saves refreshed cookies back
into the same file while it runs (and once more on shutdown), so the session
stays fresh by itself. If the cookies do expire one day, just paste a fresh
export over `account.txt` and restart.

Priority order, if you use more than one: env vars (`IG_COOKIE_STRING`, or
`IG_SESSION_ID` + `IG_CSRF_TOKEN` + `IG_USER_ID`) → `account.txt` (changeable
via `instagram.sessionFile` in config.json, or `IG_SESSION_PATH`) →
`data/session.json` (see `data/session.json.example`). Env sessions are never
written back to disk. `account.txt` and `data/session.json` are git-ignored.

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

## Updating (on a VPS, no re-clone)

```bash
node update.js
```

It fetches the remote file list from GitHub, compares git blob hashes, and
downloads **only the files that changed** — no `git clone`, no `npm install`
unless `package.json` itself changed. Your `account.txt`, `data/`,
`database/data/`, `downloads/` and config files are never touched; if a config
file changed upstream you get a `<file>.new` to merge by hand. Replaced files
are backed up under `update-backup/<timestamp>/` first. Flags:
`--dry-run` (show the plan, change nothing), `--force` (skip the prompt),
`--branch <name>`, `--no-backup`, `--restart` (`pm2 restart anchestor`).

## Commands

Default prefix is `-`. Type just `prefix` in a chat to see the current one.

| Command | Description |
| --- | --- |
| `help [command]` | list commands or show one in detail |
| `ping` | latency + uptime check |
| `uid` | your id, or the replied user's id |
| `userinfo [@user]` | profile + friendship info |
| `spy [@user]` | deep intel: profile, counts, friendship status, current note, pic |
| `threadinfo` | this thread's info, members and nicknames |
| `uptime` | how long the bot has been running |
| `count` | your tracked message count |
| `prefix <p> / reset / <p> -g` | change prefix (reaction confirm) |
| `admin list/add/remove` | manage bot admins |
| `adminonly on/off/status` | admin-only mode, saved to config.json (bot admin) |
| `whitelist on/off/add/remove/list/thread` | user + thread whitelists, saved to config.json (bot admin) |
| `say <text>` | make the bot say something |
| `edit <text> / edit last <text>` | edit a bot message (reply to it, or the last one sent) |
| `unsend` | unsend a bot message (reply to it) |
| `pin / pin off / pin list` | pin messages in this thread (reply to pin) |
| `react [emoji] / react off` | react to the replied message |
| `seen` | mark the replied message as seen |
| `forward <thread id / @user>` | forward the replied message |
| `search <text>` | search messages inside this thread |
| `nickname <name>` | set/clear nicknames in this thread |
| `theme list/set/reset` | chat themes |
| `note [post <text> / mine / delete]` | Instagram notes |
| `poll <q> \| <a> \| <b>` | create a poll |
| `song <name>` | search a song, reply with a number — sends the **30s preview clip from iTunes** (the IG api has no full-song sending; a direct `.mp3`/audio url with `-song <url>` sends that audio as-is) |
| `pfp [@user]` | send someone's profile picture in HD |
| `gif <query>` | search and send a gif |
| `share post/reel/story/profile <...>` | share a post, reel, story or profile into the thread |
| `dl [url]` | download media (replied message or direct url) into `downloads/`, images/videos get sent back |
| `adduser @user [...]` | add users to this group |
| `kick [@user]` | remove someone from this group (group admin) |
| `promote / demote [@user]` | group admin in / out (group admin) |
| `settitle <title>` | rename this group thread |
| `mute / mute off` | mute this thread for the bot account |
| `leave` | bot leaves the group (reaction confirm, bot admin) |
| `inbox` | latest conversations (bot admin) |
| `pending` | message requests — reply with a number to accept, `no <number>` to decline (bot admin) |
| `follow [follow/unfollow] @user` | friendship status / follow / unfollow |
| `followers [@user]` | a user's followers (first 20) |
| `following [@user]` | who a user follows (first 20) |
| `followreq` | pending follow requests — reply with a number to approve, `no <number>` to ignore (bot admin) |
| `block / unblock @user` | block / unblock on Instagram (bot admin) |
| `cmd load/unload/reload <name>` | manage command files at runtime (bot admin) |
| `restart` | restart the bot (bot admin) |
| `eval <code>` | run js (bot admin only) |

## Admin only & whitelist modes

Two ways to lock the bot down, both controlled from chat and **saved into
`config.json`**, so they survive restarts:

- `-adminonly on` — only bot admins (role 2) can use any command. `status`
  shows the mode, `off` opens it up again.
- `-whitelist on` — only users whose numeric Instagram id is in
  `whiteListMode.whiteListIds` can use the bot. Manage the list from chat:
  `-whitelist add @username` (resolves to the id for you), `-whitelist remove
  <id>`, `-whitelist list`.
- `-whitelist thread` — toggles **this** thread in the thread whitelist
  (`whiteListModeThread`), which restricts the bot to those threads while on.

Bot admins bypass both modes no matter what — you can't lock yourself out.

## Framework

How the machinery under the commands works:

**Command loader — first come, first served.** Files in `scripts/cmds` load in
sorted order and the first module to claim a name keeps it. A later module with
the same `config.name` is *shadowed*, not dropped: it stays reachable through
its unique aliases (aliases are claimed one by one across names and aliases —
a taken alias is skipped with a warning, the rest still register). A shadowed
module with no free alias left loads *dormant*: counted in the boot summary
(`48 commands and 4 events loaded (0 shadowed, 0 dormant)`) with the reason
logged. Unloading is ownership-exact — removing the winner frees only its name
and its own aliases, and reloading a shadowed file afterwards lets it win the
name. `-cmd collisions` prints the full registry story, `-cmd reloadall`
reloads everything, and custom aliases saved under the `setalias` global data
are applied after file loading through the same rules.

**Reply system.** `replyStore.setEntry(messageID, { commandName, threadID,
author, ttlMs, data })` binds a flow to a bot message. Entries are author
locked (someone else's reply falls through to normal handling), thread locked,
and expire after 5 minutes by default (`ttlMs` per entry). Inside `onReply`,
`Reply.keep(newData?)` survives to the next reply with a fresh TTL,
`Reply.end()` closes the flow, and a handled reply that does neither is
consumed — so one-shot flows need no cleanup code. `replyStore.setSession({
commandName, threadID, author, data })` goes one step further: the author's
next *plain* message in the thread continues the flow, no quote-reply needed.
A prefixed message always wins over a session.

**Message pipeline.** Every message runs: data/ban checks → whitelist gates →
reactions → quote replies → reply sessions (plain messages only) → `onChat`
hooks → command parsing → per-thread command bans → admin-only gate → role
gate → cooldown → `onStart`. Cooldowns are per command + thread + user and
answer with the remaining wait time; bot admins skip them. Unknown commands
get did-you-mean suggestions (`-pign` → "Did you mean: -pin, -ping?") unless
`hideNotiMessage.commandNotFound` is on. A command that throws gets its user
one clean `⚠️ <cmd> hit an error: ...` reply and the bot keeps running.

**Sending.** `message.reply` / `message.send` split long texts into ~900
character chunks on line boundaries and resolve with the last chunk's info,
so reply flows keep working on huge outputs.

**Hot reload.** Set `autoLoadScripts.enable` in `config.json` and edits under
`scripts/cmds` / `scripts/events` reload just that file (400 ms debounce,
`ignoreCmds` / `ignoreEvents` lists respected). Off by default.

**Stats & shutdown.** Every successful command run is counted in the
`commandUsage` / `commandUsageTotal` global data — see `-usage`. On
SIGINT/SIGTERM the bot disconnects, flushes the json database and exits 0
(`index.js` only restarts on code 2). The json store serializes writes per
file and keeps a `.bak` of the previous good content; a corrupt data file
falls back to its backup instead of crashing the boot.

## Project structure

```
anchestor/
├── index.js                  # spawns Anchestor.js, restarts on exit code 2
├── Anchestor.js              # core init: globals, config watch, auto restart
├── update.js                 # self-updater: pulls only changed files from GitHub
├── config.json               # main config
├── configCommands.json       # per-command env, banned commands, unload lists
├── configIgApi.json          # ig-chat-api client options
├── utils.js
├── logger/                   # log, logColor, loading
├── languages/                # en.lang, vi.lang, makeFuncGetLangs.js
├── bot/
│   ├── login/                # login.js (session + api facade), sessionFile, loadData, loadScripts
│   └── handler/              # handlerEvents (dispatch), handlerAction (message obj), handlerCheckData, replyStore
├── database/
│   ├── connectDB/            # json store (+ mongo/sqlite stubs)
│   ├── controller/           # threadsData, usersData, globalData
│   ├── models/
│   └── data/                 # threads.json, users.json, global.json
├── ig-chat-api/              # bundled Instagram chat client (see Credits)
├── scripts/
│   ├── cmds/                 # commands (48)
│   └── events/               # events
├── downloads/                # -dl output (git-ignored except .gitkeep)
└── data/
    └── session.json.example
```

## Configuration

`config.json` — prefix, bot admins, admin-only mode, whitelists, timezone, database type
(`json` is the one wired up), auto restart, `autoLoadScripts` (hot reload of command
files, off by default), log toggles and the `instagram` section
(session file `account.txt`, fallback path, poll interval, debug).

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
(fires when someone replies to a message you registered with
`replyStore.setEntry(...)` from `bot/handler/replyStore.js` — see the Framework
section for TTLs, author locks and `Reply.keep()` / `Reply.end()`),
and `onReaction` (same idea with `global.Anchestor.onReaction`, keyed by messageID).
Events live in `scripts/events/` with `onEvent` / `onStart` — files ending in `.eg.js`
are examples and never load.

The database API uses path strings: `await threadsData.get(threadID, "data.prefix")`,
`await threadsData.set(threadID, "!", "data.prefix")`, same shape for `usersData`,
and `globalData.get(key)` / `globalData.set(key, value)` for free-form values.

Commands talk Instagram through the `api` facade (`api.sendMessage`, `api.getThreadInfo`,
`api.getUserInfo`, `api.setMessageReaction`, `api.unsendMessage`, `api.changeNickname`,
`api.changeThreadTitle`, `api.editMessage`, `api.pinMessage`, `api.forwardMessage`,
`api.sendAudioFromUrl`, `api.sendImageFromUrl`, `api.downloadMedia`, `api.shareReel`,
group admin ops, pending requests, follow requests, blocks, followers and more) —
or grab `api.rawClient` for the full ig-chat-api surface
(notes, polls, themes, gifs, follow, inbox and more).

The framework also tracks the bot's own messages per thread
(`global.temp.lastBotMessage[threadID]`, plus a 10-message ring in
`global.temp.botMessages[threadID]`) and `message.edit(text, messageID?)` edits
them — that's what `-edit last` runs on.

## Security notes

- `data/session.json`, `account.txt`, `*.session.json` and `.env` are git-ignored — never commit your session. A session cookie is as good as being logged in.
- Sessions expire. If the bot starts failing with auth errors, grab fresh cookies and update the file.
- `-eval` and `-cmd` are bot-admin only for a reason. Keep `adminBot` limited to yourself.

## Credits

- **ig-chat-api** (in `ig-chat-api/`) is based on **instagram-chat-api by JARiF (jarif098)** — https://github.com/jarif098/instagram-chat-api — MIT licensed, license kept in `ig-chat-api/LICENSE`.
- anchestor itself is developed by **xemonbae01**.

## License

MIT
