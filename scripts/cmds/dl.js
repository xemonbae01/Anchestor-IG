const fs = require("fs");
const path = require("path");

module.exports = {
	config: {
		name: "dl",
		aliases: ["download"],
		version: "1.0.0",
		author: "xemonbae01",
		countDown: 5,
		role: 0,
		description: { en: "download media from a message or a direct url into downloads/" },
		category: "media",
		guide: { en: "   reply to a message with media + {pn}" +
			"\n   {pn} <media url>" }
	},

	onStart: async function ({ message, event, args, api }) {
		const client = api.rawClient;
		if (!client) return message.reply("ig client not available");

		let url = null;
		let kind = null;

		if (args[0] && /^https?:\/\/\S+$/.test(args[0])) {
			url = args[0];
		}

		// media on the message itself
		if (!url && Array.isArray(event.attachments)) {
			const att = event.attachments.find((a) => a && a.url);
			if (att) { url = att.url; kind = att.type || null; }
		}

		// replied message: the event only carries its id, so dig the media out of the thread
		if (!url && event.messageReply && event.messageReply.messageID && client.getMessages) {
			try {
				const res = await client.getMessages(event.threadID, { limit: 30 });
				const msgs = Array.isArray(res) ? res : (res.messages || res.items || []);
				const found = msgs.find((m) => String(m.id || m.messageID) === String(event.messageReply.messageID));
				if (found && found.media && found.media.url) { url = found.media.url; kind = found.media.type || null; }
			} catch { /* fall through to the error below */ }
		}

		if (!url) return message.reply("nothing to download. reply to a message with media or give me a direct url");

		const extMatch = /\.([a-z0-9]{2,5})(?:\?|$)/i.exec(url);
		const ext = extMatch ? `.${extMatch[1].toLowerCase()}` : ".bin";
		const dir = path.join(__dirname, "..", "..", "downloads");
		fs.mkdirSync(dir, { recursive: true });
		const name = `dl_${Date.now()}${ext}`;
		const dest = path.join(dir, name);

		try {
			if (api.downloadMedia) await api.downloadMedia(url, dest);
			else await client.downloadMedia(url, dest);
			const size = fs.existsSync(dest) ? fs.statSync(dest).size : 0;

			// send images and videos straight back into the thread
			const isImage = kind === "image" || [".jpg", ".jpeg", ".png", ".webp"].includes(ext);
			const isVideo = kind === "video" || [".mp4", ".mov"].includes(ext);
			let resent = "";
			try {
				if (isImage) {
					if (api.sendImage) await api.sendImage(event.threadID, dest);
					else await client.sendImage(event.threadID, dest);
					resent = "\nsent back into the thread";
				}
				else if (isVideo) {
					if (api.sendVideo) await api.sendVideo(event.threadID, dest);
					else await client.sendVideo(event.threadID, dest);
					resent = "\nsent back into the thread";
				}
			} catch { /* saved is enough if resend fails */ }

			return message.reply(`saved as downloads/${name} (${size} bytes)${resent}`);
		}
		catch (err) {
			return message.reply(`download failed: ${err.message}`);
		}
	}
};
