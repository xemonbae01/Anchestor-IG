module.exports = {
	config: {
		name: "song",
		aliases: ["sing"],
		version: "1.0.0",
		author: "xemonbae01",
		countDown: 5,
		role: 0,
		description: { en: "search a song and send the audio, or send a direct audio link" },
		category: "media",
		guide: { en: "   {pn} <song name>: search, then reply with a number to get it" +
			"\n   {pn} <audio url>: send that audio directly" }
	},

	langs: {
		en: {
			listHead: "pick a number:\n%1",
			listFoot: "\nreply to this message with the number",
			sending: "sending: %1 — %2",
			previewNote: "this is the 30s preview clip from iTunes, not the full song",
			notFound: "no song found for \"%1\"",
			badPick: "that number isn't in the list"
		}
	},

	async sendAudio(api, threadID, url) {
		if (api.sendAudioFromUrl) return api.sendAudioFromUrl(threadID, url);
		return api.rawClient.sendAudioFromUrl(threadID, url);
	},

	onStart: async function ({ message, event, args, api, getLang }) {
		if (!args.length) return message.SyntaxError();
		const query = args.join(" ").trim();
		const sendAudio = module.exports.sendAudio;

		// direct audio link, no search needed
		if (/^https?:\/\/\S+$/.test(query)) {
			try {
				await sendAudio(api, event.threadID, query);
				return message.send("sent 🎧 (direct audio link)");
			}
			catch (err) {
				return message.reply(`failed to send that audio: ${err.message}`);
			}
		}

		// ig api has no song search, itunes preview search does the job
		let tracks = [];
		try {
			const axios = require("axios");
			const res = await axios.get("https://itunes.apple.com/search", {
				params: { term: query, media: "music", entity: "song", limit: 5 },
				timeout: 15000
			});
			tracks = ((res.data && res.data.results) || []).filter((t) => t.previewUrl);
		}
		catch (err) {
			return message.reply(`song search failed: ${err.message}`);
		}
		if (!tracks.length) return message.reply(getLang("notFound", query));

		const list = tracks.map((t, i) =>
			`${i + 1}. ${t.trackName || "unknown"} — ${t.artistName || "?"}\n   album: ${t.collectionName || "-"}`
		).join("\n");
		const info = await message.reply(getLang("listHead", list) + getLang("listFoot"));
		if (info && info.messageID) {
			global.Anchestor.onReply.set(info.messageID, {
				commandName: "song",
				messageID: info.messageID,
				threadID: event.threadID,
				senderID: event.senderID,
				tracks: tracks.map((t) => ({
					trackName: t.trackName || "unknown",
					artistName: t.artistName || "?",
					previewUrl: t.previewUrl
				}))
			});
		}
		return info;
	},

	onReply: async function ({ message, event, args, api, onReply, getLang }) {
		const tracks = (onReply && onReply.tracks) || [];
		const pick = parseInt(args[0], 10);
		if (!pick || pick < 1 || pick > tracks.length) {
			await message.reply(getLang("badPick"));
			return true;
		}
		const track = tracks[pick - 1];
		global.Anchestor.onReply.delete(event.messageReply.messageID);
		try {
			await module.exports.sendAudio(api, event.threadID, track.previewUrl);
			await message.send(getLang("sending", track.trackName, track.artistName) + `\n${getLang("previewNote")}`);
		}
		catch (err) {
			await message.reply(`failed to send the song: ${err.message}`);
		}
		return true;
	}
};
