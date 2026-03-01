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

// ================= Railway keep alive =================
const app = express();
app.get("/", (req, res) => res.send("hyPex & Mova aktif"));
app.listen(process.env.PORT || 3000);
// ======================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

const player = new Player(client);

// Lavalink bağlantısı
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
    activities: [
      { name: "hyPex & Mova | !oynat", type: ActivityType.Listening }
    ],
    status: "online"
  });
});

client.on("messageCreate", async (message) => {
  try {
    if (!message.guild) return;
    if (message.author.bot) return;

    if (!message.content.startsWith("!")) return;

    const args = message.content.slice(1).trim().split(" ");
    const command = args.shift().toLowerCase();

    // Guild cache kontrolü (Railway fix)
    const guild = await client.guilds.fetch(message.guild.id).catch(() => null);
    if (!guild) {
      return message.reply("Sunucu bilgisi alınamadı. Tekrar deneyin.");
    }

    const voiceChannel = message.member.voice.channel;

    // ===== OYNAT =====
    if (command === "oynat") {
      if (!voiceChannel)
        return message.reply("Önce bir ses kanalına gir!");

      const query = args.join(" ");
      if (!query)
        return message.reply("!oynat <şarkı adı veya link>");

      await player.play(voiceChannel, query, {
        nodeOptions: {
          metadata: {
            channel: message.channel
          },
          leaveOnEnd: false,
          leaveOnStop: true,
          leaveOnEmpty: true,
          volume: 100
        }
      });

      message.reply(`🎶 hyPex & Mova çalıyor: ${query}`);
    }

    // ===== GEÇ =====
    if (command === "geç") {
      const queue = player.nodes.get(message.guild.id);
      if (!queue) return message.reply("Çalan şarkı yok.");
      queue.node.skip();
      message.reply("Geçildi.");
    }

    // ===== DUR =====
    if (command === "dur") {
      const queue = player.nodes.get(message.guild.id);
      if (!queue) return message.reply("Queue yok.");
      queue.delete();
      message.reply("Durduruldu.");
    }

    // ===== ÇIK =====
    if (command === "çık") {
      const queue = player.nodes.get(message.guild.id);
      if (!queue) return message.reply("Zaten bağlı değilim.");
      queue.delete();
      message.reply("Ses kanalından çıktım.");
    }
  } catch (err) {
    console.error("Komut hatası:", err);
    message.reply("Bir hata oluştu, tekrar deneyin.");
  }
});

client.login(process.env.TOKEN);
