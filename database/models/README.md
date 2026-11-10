# models

The json store doesn't use schema models — records are plain objects created by the
controllers in `database/controller/`:

- thread: `{ threadID, threadName, isGroup, participantIDs, adminIDs, memberCount, messageCount, data: {}, banned: { status, reason, date } }`
- user: `{ userID, name, username, data: {}, banned: { status, reason, date }, exp, messageCount }`
- global: free-form key/value in `database/data/global.json`

Mongo/sqlite model folders would live here (`models/mongodb`, `models/sqlite`) when those
drivers get wired in. For now `database.type` only supports `json`.
