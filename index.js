const { Client, GatewayIntentBits } = require("discord.js");
const { Player } = require("discord-player");
require("dotenv").config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent
    ]
});

const player = new Player(client);

client.once("ready", () => {
    console.log("hyPex & Mova Music System Aktif!");

    client.user.setPresence({
        activities: [{ name: "hyPex & Mova Music", type: 2 }],
        status: "online"
    });
});

client.on("messageCreate", async (message) => {
    if (!message.guild || message.author.bot) return;

    const prefix = "!";
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(" ");
    const command = args.shift().toLowerCase();

    if (command === "oynat") {
        const query = args.join(" ");
        if (!query) return message.reply("Şarkı adı veya link gir!");

        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) return message.reply("Ses kanalına gir!");

        const queue = await player.nodes.create(message.guild, {
            metadata: message.channel
        });

        if (!queue.connection) await queue.connect(voiceChannel);

        const result = await player.search(query, {
            requestedBy: message.author
        });

        if (!result.tracks.length) {
            return message.reply("Sonuç bulunamadı!");
        }

        queue.addTrack(result.tracks[0]);

        if (!queue.isPlaying()) {
            await queue.node.play();
        }

        message.channel.send(`🎵 Çalınıyor: **${result.tracks[0].title}**`);
    }
});

client.login(process.env.TOKEN);
