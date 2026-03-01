require(dotenv).config();
const { Client, GatewayIntentBits } = require(discord.js);
const { Manager } = require(erela.js);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const manager = new Manager({
    nodes: [
  {
    host: process.env.LAVALINK_HOST,
    port: Number(process.env.LAVALINK_PORT),
    password: process.env.LAVALINK_PASSWORD
  }
],
    send(id, payload) {
        const guild = client.guilds.cache.get(id);
        if (guild) guild.shard.send(payload);
    }
});

client.once("ready", () => {
    console.log("hyPex & Mova Music System Aktif!");

    client.user.setPresence({
        activities: [{ name: "hyPex & Mova Music", type: 2 }],
        status: "online",
    });
});

client.on(raw, (d) = manager.updateVoiceState(d));

client.on(messageCreate, async (message) = {
    if (!message.guild  message.author.bot) return;

    const args = message.content.split( );
    const cmd = args.shift().toLowerCase();

    if (cmd === !oynat) {
        if (!message.member.voice.channel)
            return message.reply(Önce ses kanalına gir!);

        const query = args.join( );
        if (!query) return;

        let player = manager.players.get(message.guild.id);
        if (!player) {
            player = manager.create({
                guild message.guild.id,
                voiceChannel message.member.voice.channel.id,
                textChannel message.channel.id,
                selfDeafen true
            });
            player.connect();
        }

        const res = await manager.search(query, message.author);
        if (!res.tracks.length)
            return message.reply(Sonuç bulunamadı.);

        player.queue.add(res.tracks[0]);
        message.channel.send(`🎵 hyPex & Mova çalıyor ${res.tracks[0].title}`);

        if (!player.playing && !player.paused)
            player.play();
    }

    if (cmd === !geç) {
        const player = manager.players.get(message.guild.id);
        if (player) player.stop();
    }

    if (cmd === !dur) {
        const player = manager.players.get(message.guild.id);
        if (player) player.destroy();
    }
});


client.login(process.env.TOKEN);






