const discord = require('discord.js');
require('dotenv').config();
const client = new discord.Client({
  intents: ['Guilds', 'GuildMessages', 'GuildVoiceStates', 'MessageContent']
});
const { DisTube } = require('distube');

// DisTube setup
client.DisTube = new DisTube(client, {
  emitNewSongOnly: true,
  emitAddSongWhenCreatingQueue: false,
  emitAddListWhenCreatingQueue: false
});

client.on('ready', () => {
  console.log(`${client.user.tag} is online!`);
});

// Regular message replies
client.on('messageCreate', message => {
  try {
    if (message.author.bot || !message.guild) return;
    const prefix = '-';
    if (!message.content.toLowerCase().startsWith(prefix)) return;
    const args = message.content.slice(prefix.length).trim().split(/ +/g);
    const command = args.shift().toLowerCase();

    // Command to PLAY music
    if (command === 'play' || command === 'sing') {
      if (!message.member.voice.channel) {
        return message.channel.send(
          'You must be in a voice channel to use this command!'
        );
      }

      if (args.join(' ') == null || args.join(' ') == '') return;

      client.DisTube.play(message.member.voice.channel, args.join(' '), {
        member: message.member,
        textChannel: message.channel,
        message
      });
    }

    // Command to STOP music
    if (command === 'stop' || command === 'leave') {
      if (!message.member.voice.channel) {
        return message.channel.send(
          'You must be in a voice channel to use this command!'
        );
      }

      let queue = client.DisTube.getQueue(message);
      if (queue) {
        client.DisTube.stop(message);
        message.channel.send('okay hehe');
      } else if (!queue) {
        return;
      }
    }

    // Command to SKIP music
    if (command === 'skip') {
      if (!message.member.voice.channel)
        return message.channel.send(
          'You must be in a voice channel to use this command!'
        );

      client.DisTube.skip(message);
    }

    // Command to view the QUEUE
    if (command == 'queue') {
      let queue = client.DisTube.getQueue(message);
      if (!queue)
        return message.channel.send('There is nothing currently in the queue');

      message.channel.send(
        '```' +
          queue.songs
            .map(
              (song, id) =>
                `${id === 0 ? 'Singing:' : `${id}.`} ${song.name} - ${
                  song.formattedDuration
                }`
            )
            .slice(0, 10)
            .join('\n') +
          '```'
      );
    }
  } catch (err) {
    console.log(err);
  }
});

// Function to handle the embedded message when a song is played
function playSongEmbed(name, url, user) {
  return new discord.EmbedBuilder()
    .setColor('#6CBEED')
    .setTitle('Now singing')
    .setDescription(`[${name}](${url}) [${user}]`);
}

// Function to handle the embedded message when a song is added to the queue
function addSongEmbed(name, url, user) {
  return new discord.EmbedBuilder()
    .setColor('#6CBEED')
    .setDescription(
      `Warming up my vocal chords to sing [${name}](${url}) [${user}]`
    );
}

// Events for DisTube functions
client.DisTube.on('initQueue', queue => {
  queue.volume = 100;
})
  .on('playSong', (queue, song) =>
    queue.textChannel.send({
      embeds: [playSongEmbed(song.name, song.url, song.user)]
    })
  )
  .on('addSong', (queue, song) =>
    queue.textChannel.send({
      embeds: [addSongEmbed(song.name, song.url, song.user)]
    })
  );

client.login(process.env.TOKEN);
