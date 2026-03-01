require("dotenv").config();

const http = require("http");
const { Client, GatewayIntentBits, Partials } = require("discord.js");
const { Shoukaku, Connectors } = require("shoukaku");

// =====================
// ENV KONTROL
// =====================
const TOKEN = process.env.TOKEN;
const LAVALINK_HOST = process.env.LAVALINK_HOST;
const LAVALINK_PORT = process.env.LAVALINK_PORT || "2333";
const LAVALINK_PASSWORD = process.env.LAVALINK_PASSWORD || process.env.LAVALINK_PASS || process.env.LAVALINK_AUTH;
const LAVALINK_SECURE = String(process.env.LAVALINK_SECURE || "false").toLowerCase() === "true";

if (!TOKEN) {
  console.error("HATA: TOKEN env yok. Railway Variables -> TOKEN ekle.");
  process.exit(1);
}
if (!LAVALINK_HOST || !LAVALINK_PASSWORD) {
  console.error("HATA: LAVALINK_HOST veya LAVALINK_PASSWORD env yok.");
  console.error("Railway Variables -> LAVALINK_HOST, LAVALINK_PORT, LAVALINK_PASSWORD ekle.");
  process.exit(1);
}

// =====================
// RAILWAY KEEP-ALIVE (opsiyonel ama güvenli)
// =====================
const PORT = process.env.PORT;
if (PORT) {
  http
    .createServer((req, res) => {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("hyPex & Mova Music System Aktif!\n");
    })
    .listen(PORT, () => console.log(`HTTP keep-alive dinleniyor: ${PORT}`));
}

// =====================
// DISCORD CLIENT
// =====================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [Partials.Channel]
});

const PREFIX = "!";
const BRAND = "hyPex & Mova";

// =====================
// LAVALINK NODES (Railway internal)
// =====================
const nodes = [
  {
    name: "railway-lavalink",
    url: `${LAVALINK_HOST}:${LAVALINK_PORT}`,
    auth: LAVALINK_PASSWORD,
    secure: LAVALINK_SECURE
  }
];

// =====================
// SHOUKAKU
// =====================
const connector = new Connectors.DiscordJS(client);
const shoukaku = new Shoukaku(connector, nodes, {
  resumable: true,
  resumableTimeout: 60,
  reconnectTries: 5,
  reconnectInterval: 5
});

// =====================
// QUEUE (guild bazlı)
// =====================
const queues = new Map(); // guildId -> { player, tracks: [], textChannelId, voiceChannelId }

// Yardımcı: mesaj at
async function reply(message, text) {
  try {
    await message.channel.send(text);
  } catch {}
}

// Yardımcı: güvenli guild kontrol
function ensureGuildMessage(message) {
  if (!message.guildId) return false; // DM ise null
  return true;
}

// Yardımcı: node seç
function getNode() {
  const node = shoukaku.nodes.get("railway-lavalink");
  if (node && node.state === 2) return node; // 2 = CONNECTED
  // fallback: bağlı herhangi node
  for (const [, n] of shoukaku.nodes) {
    if (n.state === 2) return n;
  }
  return null;
}

// Yardımcı: track resolve
async function resolveTrack(node, query) {
  // URL ise direkt resolve, değilse ytsearch:
  const isUrl = /^https?:\/\//i.test(query);
  const identifier = isUrl ? query : `ytsearch:${query}`;
  const res = await node.rest.resolve(identifier);

  // Lavalink sürümlerine göre alanlar değişebiliyor: tracks / data
  const tracks = res?.tracks || res?.data || [];
  if (!tracks.length) return null;

  // "ytsearch" dönerse ilkini al
  return tracks[0];
}

// Yardımcı: player al/oluştur + vc join
async function getOrCreatePlayer(message) {
  const guildId = message.guildId;
  const member = message.member;
  const voice = member?.voice?.channel;

  if (!voice) {
    await reply(message, "Ses kanalına girmen lazım. Sonra tekrar: `!oynat <şarkı>`");
    return null;
  }

  const node = getNode();
  if (!node) {
    await reply(message, "Lavalink bağlantısı yok. Railway'de lavalink servisi çalışıyor mu?");
    return null;
  }

  let q = queues.get(guildId);
  if (!q) {
    q = { player: null, tracks: [], textChannelId: message.channelId, voiceChannelId: voice.id };
    queues.set(guildId, q);
  }

  q.textChannelId = message.channelId;
  q.voiceChannelId = voice.id;

  if (!q.player) {
    const player = await node.joinChannel({
      guildId,
      channelId: voice.id,
      shardId: message.guild.shardId
    });

    q.player = player;

    // Track bitince sıradakine geç
    player.on("end", async () => {
      const nq = queues.get(guildId);
      if (!nq) return;

      if (nq.tracks.length === 0) {
        // Kuyruk bitti -> çık
        try {
          const n = getNode();
          if (n) n.leaveChannel(guildId);
        } catch {}
        queues.delete(guildId);
        return;
      }

      const next = nq.tracks.shift();
      try {
        await nq.player.playTrack({ track: next.encoded || next.track || next });
      } catch (e) {
        // Problem olursa sonraki
        console.error("SONRAKI CALMA HATASI:", e?.message || e);
      }
    });

    player.on("closed", () => {
      queues.delete(guildId);
    });
  }

  return q;
}

// =====================
// SHOUKAKU EVENTLER
// =====================
shoukaku.on("ready", (name) => console.log(`Lavalink hazır: ${name}`));
shoukaku.on("error", (name, error) => console.error(`Lavalink hata (${name}):`, error));
shoukaku.on("disconnect", (name, reason) => console.warn(`Lavalink disconnect (${name}):`, reason));
shoukaku.on("reconnecting", (name) => console.warn(`Lavalink reconnecting (${name})...`));
shoukaku.on("close", (name, code, reason) => console.warn(`Lavalink closed (${name}) code=${code} reason=${reason}`));

// =====================
// DISCORD READY
// =====================
client.once("ready", async () => {
  console.log(`${BRAND} Music System Aktif!`);
  try {
    await client.user.setPresence({
      activities: [{ name: `${BRAND} | !oynat`, type: 2 }],
      status: "online"
    });
  } catch {}
});

// =====================
// KOMUTLAR
// =====================
client.on("messageCreate", async (message) => {
  try {
    if (message.author.bot) return;
    if (!message.content.startsWith(PREFIX)) return;

    // DM engelle: guild yoksa crash olmasın
    if (!ensureGuildMessage(message)) {
      await reply(message, "Bu bot sadece sunucularda çalışır (DM'de çalışmaz).");
      return;
    }

    const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
    const cmd = (args.shift() || "").toLowerCase();

    if (cmd === "ping") {
      await reply(message, "Pong!");
      return;
    }

    if (cmd === "yardım" || cmd === "help") {
      await reply(
        message,
        [
          `**${BRAND} Komutlar**`,
          "`!oynat <şarkı/URL>` - Çalar",
          "`!geç` - Sonraki",
          "`!duraklat` - Duraklat",
          "`!devam` - Devam ettir",
          "`!kuyruk` - Kuyruğu göster",
          "`!çık` - Ses kanalından çıkar"
        ].join("\n")
      );
      return;
    }

    if (cmd === "oynat") {
      const query = args.join(" ").trim();
      if (!query) {
        await reply(message, "Kullanım: `!oynat <şarkı adı veya URL>`");
        return;
      }

      const q = await getOrCreatePlayer(message);
      if (!q) return;

      const node = getNode();
      if (!node) {
        await reply(message, "Lavalink node bulunamadı.");
        return;
      }

      let track;
      try {
        track = await resolveTrack(node, query);
      } catch (e) {
        console.error("RESOLVE HATASI:", e?.message || e);
        await reply(message, "Şarkı aranırken hata oldu. (Lavalink YouTube source çalışıyor mu?)");
        return;
      }

      if (!track) {
        await reply(message, "Sonuç bulunamadı. Başka bir arama dene.");
        return;
      }

      const title = track.info?.title || track.title || "Bilinmeyen parça";
      const uri = track.info?.uri || track.uri || "";

      // Şu an çalmıyorsa direkt çal, çalıyorsa kuyruğa ekle
      if (!q.player.playing && !q.player.paused) {
        try {
          await q.player.playTrack({ track: track.encoded || track.track || track });
          await reply(message, `🎶 Şimdi çalıyor: **${title}**\n${uri}`);
        } catch (e) {
          console.error("PLAY HATASI:", e?.message || e);
          await reply(message, "Çalmaya başlarken hata oldu. Lavalink loglarını kontrol et.");
        }
      } else {
        q.tracks.push(track);
        await reply(message, `✅ Kuyruğa eklendi: **${title}**`);
      }

      return;
    }

    if (cmd === "geç" || cmd === "skip") {
      const q = queues.get(message.guildId);
      if (!q?.player) {
        await reply(message, "Şu an çalan bir şey yok.");
        return;
      }
      try {
        await q.player.stopTrack();
        await reply(message, "⏭️ Geçildi.");
      } catch {
        await reply(message, "Geçme sırasında hata oldu.");
      }
      return;
    }

    if (cmd === "duraklat" || cmd === "pause") {
      const q = queues.get(message.guildId);
      if (!q?.player) {
        await reply(message, "Şu an çalan bir şey yok.");
        return;
      }
      try {
        q.player.setPaused(true);
        await reply(message, "⏸️ Duraklatıldı.");
      } catch {
        await reply(message, "Duraklatırken hata oldu.");
      }
      return;
    }

    if (cmd === "devam" || cmd === "resume") {
      const q = queues.get(message.guildId);
      if (!q?.player) {
        await reply(message, "Şu an çalan bir şey yok.");
        return;
      }
      try {
        q.player.setPaused(false);
        await reply(message, "▶️ Devam ediyor.");
      } catch {
        await reply(message, "Devam ettirirken hata oldu.");
      }
      return;
    }

    if (cmd === "kuyruk" || cmd === "queue") {
      const q = queues.get(message.guildId);
      if (!q?.player) {
        await reply(message, "Kuyruk boş.");
        return;
      }

      const list = q.tracks.slice(0, 10).map((t, i) => {
        const title = t.info?.title || t.title || "Bilinmeyen";
        return `${i + 1}. ${title}`;
      });

      await reply(
        message,
        list.length ? `📜 **Kuyruk (ilk 10)**\n${list.join("\n")}` : "Kuyruk boş."
      );
      return;
    }

    if (cmd === "çık" || cmd === "leave" || cmd === "disconnect") {
      const guildId = message.guildId;
      const q = queues.get(guildId);
      if (!q?.player) {
        await reply(message, "Zaten ses kanalında değilim.");
        return;
      }

      try {
        const node = getNode();
        if (node) node.leaveChannel(guildId);
      } catch {}

      queues.delete(guildId);
      await reply(message, "👋 Ses kanalından çıktım.");
      return;
    }

    // bilinmeyen komut
    await reply(message, "Bilinmeyen komut. `!yardım` yaz.");
  } catch (err) {
    console.error("MESSAGE HANDLER HATASI:", err);
  }
});

// =====================
// LOGIN
// =====================
client.login(TOKEN);
