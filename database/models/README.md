# models

Record shapes, one file per collection. The controllers in
`database/controller/` own the actual default records — these descriptors
just name the collection, the key field and the indexes for the mongodb
backend (created idempotently on boot by `models/mongodb/index.js`).

- thread: `{ threadID, threadName, isGroup, participantIDs, adminIDs, memberCount, messageCount, data: {}, banned: { status, reason, date } }` — unique index on `threadID`
- user: `{ userID, name, username, data: {}, banned: { status, reason, date }, exp, messageCount }` — unique index on `userID`
- global: free-form key/value, stored as `{ _id: "<key>", value: <any> }` — the key is the `_id`, no extra index needed

The json store uses the same shapes in `database/data/*.json`, no models
needed. `models/mongodb/` is the wired backend; a sqlite folder would live
here if that driver ever gets added.
