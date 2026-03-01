"use strict";

require("dotenv").config();

const express = require("express");
const {
  Client,
  GatewayIntentBits,
  Partials,
  ActivityType
} = require("discord.js");

const { Player } = require("discord-player");

// ================= Railway keep-alive =================
const app = express();
app.get("/", (req, res) => res.send("hyPex & Mova aktif"));
app.listen(process.env.PORT || 3000);
// ======================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,        // ÖNEMLİ: member fetch/caching için
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel, Partials.GuildMember]
});

const player = new Player(client);

// Lavalink Node (Railway internal)
player.nodes.create({
  identifier: "railway",
  host: process.env.LAVALINK_HOST,
  port: Number(process.env.LAVALINK_PORT),
  password: process.env.LAVALINK_PASSWORD,
  secure: false
});

client.once("ready", () => {
  console.log("hyPex & Mova Music System Aktif!");
  client.user.setPresence({
    activities: [{ name: "hyPex & Mova | !oynat", type: ActivityType.Listening }],
    status: "online"
  });
});

// Basit hata logları (çökmeyi engeller)
player.events.on("error", (queue, err) => console.error("[PLAYER ERROR]", err));
player.events.on("playerError", (queue, err) => console.error("[PLAYBACK ERROR]", err));

client.on("messageCreate", async (message) => {
  try {
    // DM engelle
    if (!message.guild) return;
    if (message.author.bot) return;
    if (!message.content.startsWith("!")) return;

    // Guild'i kesin fetch (Railway cache sorunu fix)
    const guild = await client.guilds.fetch(message.guild.id).catch(() => null);
    if (!guild) return message.reply("Sunucu bilgisi alınamadı. 5 sn sonra tekrar dene.");

    // Member'ı kesin fetch (voice channel garantile)
    const member = await guild.members.fetch(message.author.id).catch(() => null);
    if (!member) return message.reply("Üye bilgisi alınamadı. Tekrar dene.");

    const args = message.content.slice(1).trim().split(/\s+/);
    const command = (args.shift() || "").toLowerCase();

    // ===== OYNAT =====
    if (command === "oynat") {
      const voiceChannel = member.voice?.channel;
      if (!voiceChannel) return message.reply("Önce bir ses kanalına gir!");

      const query = args.join(" ");
      if (!query) return message.reply("Kullanım: `!oynat <şarkı adı veya link>`");

      // discord-player'a guild’i açık veriyoruz -> ERR_NO_GUILD fix
      await player.play(voiceChannel, query, {
        guild, // <<< ÖNEMLİ
        nodeOptions: {
          metadata: { textChannel: message.channel, requestedBy: message.author.tag },
          leaveOnEnd: false,
          leaveOnStop: true,
          leaveOnEmpty: true,
          volume: 100
        }
      });

      return message.reply(`🎶 hyPex & Mova çalıyor: **${query}**`);
    }

    // ===== GEÇ =====
    if (command === "geç") {
      const queue = player.nodes.get(guild.id);
      if (!queue) return message.reply("Çalan şarkı yok.");
      queue.node.skip();
      return message.reply("⏭️ Geçildi.");
    }

    // ===== DUR =====
    if (command === "dur") {
      const queue = player.nodes.get(guild.id);
      if (!queue) return message.reply("Queue yok.");
      queue.delete();
      return message.reply("⏹️ Durduruldu.");
    }

    // ===== ÇIK =====
    if (command === "çık") {
      const queue = player.nodes.get(guild.id);
      if (!queue) return message.reply("Zaten bağlı değilim.");
      queue.delete();
      return message.reply("👋 Ses kanalından çıktım.");
    }
  } catch (err) {
    console.error("Komut hatası:", err);
    try {
      return message.reply("Bir hata oluştu. Tekrar dene.");
    } catch {}
  }
});

client.login(process.env.TOKEN);
