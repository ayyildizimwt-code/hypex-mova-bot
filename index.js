"use strict";

/**
 * hyPex & Mova Railway Music Bot (Discord.js v14 + discord-player v6 + Lavalink)
 * Komutlar:
 *  !oynat <şarkı adı veya URL>
 *  !geç
 *  !dur
 *  !çık
 */

require("dotenv").config();

const express = require("express");
const { Client, GatewayIntentBits, Partials, ActivityType } = require("discord.js");
const { Player } = require("discord-player");
const { GuildQueueEvent } = require("discord-player");

// ============ Railway Keep-Alive (PORT dinlemezsen Railway kapatır) ============
const app = express();
app.get("/", (req, res) => res.status(200).send("hyPex & Mova Bot Aktif ✅"));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[WEB] Keep-alive çalışıyor: ${PORT}`));
// ============================================================================

// Zorunlu: Discord Voice şifreleme için (Railway/Linux ortamlarında şart olabiliyor)
try {
  require("libsodium-wrappers");
} catch (_) {
  // libsodium-wrappers yüklü değilse yine de denesin diye boş bırakıyoruz
}

// ENV kontrol
const TOKEN = process.env.TOKEN;
const LAVALINK_HOST = process.env.LAVALINK_HOST;
const LAVALINK_PORT = process.env.LAVALINK_PORT;
const LAVALINK_PASSWORD = process.env.LAVALINK_PASSWORD;
const PREFIX = process.env.PREFIX || "!";

if (!TOKEN) {
  console.error("[HATA] TOKEN env bulunamadı. Railway Variables -> TOKEN ekle.");
  process.exit(1);
}

if (!LAVALINK_HOST || !LAVALINK_PORT || !LAVALINK_PASSWORD) {
  console.error(
    "[HATA] Lavalink env eksik.\nGerekli: LAVALINK_HOST, LAVALINK_PORT, LAVALINK_PASSWORD"
  );
  process.exit(1);
}

// Discord Client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

// Player
const player = new Player(client);

// Lavalink Node bağla (Railway internal)
player.nodes.create({
  identifier: "railway-lavalink",
  host: LAVALINK_HOST,
  port: Number(LAVALINK_PORT),
  password: LAVALINK_PASSWORD,
  secure: false // railway.internal genelde ws/ http (TLS değil)
});

// Player event logları (hata ayıklamak için)
player.events.on(GuildQueueEvent.PlayerStart, (queue, track) => {
  queue.metadata?.channel?.send(`🎶 **Şimdi çalıyor:** **${track.title}**`);
});

player.events.on(GuildQueueEvent.AudioError, (queue, error) => {
  console.error("[AudioError]", error);
  queue.metadata?.channel?.send("⚠️ Ses tarafında bir hata oldu. Başka bir şarkı deneyin.");
});

player.events.on(GuildQueueEvent.Error, (queue, error) => {
  console.error("[QueueError]", error);
  queue.metadata?.channel?.send("⚠️ Oynatma sırasında bir hata oluştu.");
});

// Ready
client.once("ready", () => {
  console.log("hyPex & Mova Music System Aktif!");
  client.user.setPresence({
    activities: [{ name: "hyPex & Mova | !oynat", type: ActivityType.Listening }],
    status: "online"
  });
});

// Komutlar (message-based)
client.on("messageCreate", async (message) => {
  try {
    if (!message.guild) return;
    if (message.author.bot) return;

    const content = message.content?.trim();
    if (!content || !content.startsWith(PREFIX)) return;

    const args = content.slice(PREFIX.length).trim().split(/\s+/);
    const command = (args.shift() || "").toLowerCase();

    // !oynat
    if (command === "oynat") {
      const query = args.join(" ");
      if (!query) return message.reply("❌ Kullanım: `!oynat <şarkı adı veya URL>`");

      const voiceChannel = message.member?.voice?.channel;
      if (!voiceChannel) return message.reply("❌ Önce bir ses kanalına gir.");

      // Discord-player play
      await player.play(voiceChannel, query, {
        nodeOptions: {
          metadata: { channel: message.channel },
          // Lavalink ile bağlantı ayarları
          leaveOnEmpty: true,
          leaveOnEmptyCooldown: 30_000,
          leaveOnEnd: false,
          leaveOnStop: true,
          pauseOnEmpty: true,
          bufferingTimeout: 15_000,
          volume: 100
        }
      });

      return message.reply(`✅ **hyPex & Mova** çalmaya başladı: \`${query}\``);
    }

    // !geç
    if (command === "geç" || command === "gec" || command === "skip") {
      const queue = player.nodes.get(message.guild.id);
      if (!queue || !queue.isPlaying()) return message.reply("❌ Şu an çalan bir şey yok.");

      queue.node.skip();
      return message.reply("⏭️ Geçildi.");
    }

    // !dur
    if (command === "dur" || command === "stop") {
      const queue = player.nodes.get(message.guild.id);
      if (!queue) return message.reply("❌ Queue yok.");

      queue.delete();
      return message.reply("⏹️ Durduruldu ve kuyruk temizlendi.");
    }

    // !çık
    if (command === "çık" || command === "cik" || command === "leave") {
      const queue = player.nodes.get(message.guild.id);
      if (!queue) return message.reply("❌ Zaten ses kanalında değilim.");

      queue.delete();
      return message.reply("👋 Ses kanalından çıktım.");
    }

    // Yardım
    if (command === "yardım" || command === "help") {
      return message.reply(
        [
          "**hyPex & Mova Komutlar**",
          "`!oynat <şarkı adı/URL>`",
          "`!geç`",
          "`!dur`",
          "`!çık`"
        ].join("\n")
      );
    }
  } catch (err) {
    console.error("[CMD_ERROR]", err);
    try {
      await message.reply("⚠️ Bir hata oldu. Loglardan bakıyorum.");
    } catch (_) {}
  }
});

// Login
client.login(TOKEN);
