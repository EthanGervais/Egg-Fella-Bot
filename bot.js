const discord = require('discord.js');
require('dotenv').config();
const client = new discord.Client({
  intents: ['Guilds', 'GuildMessages', 'GuildVoiceStates', 'MessageContent']
});
const { DisTube } = require('distube');
const { SpotifyPlugin } = require('@distube/spotify');

// DisTube setup
client.DisTube = new DisTube(client, {
  emitNewSongOnly: true,
  emitAddSongWhenCreatingQueue: false,
  emitAddListWhenCreatingQueue: false,
  plugins: [
    new SpotifyPlugin({
      emitEventsAfterFetching: true
    })
  ]
});

client.on('ready', () => {
  console.log(`${client.user.tag} is online!`);
});

let replaceFlag = false; // This variable needs to be global so it can be used in events.

// Regular message replies
client.on('messageCreate', async message => {
  try {
    if (message.author.bot || !message.guild) return;

    const prefix = '-';
    if (!message.content.toLowerCase().startsWith(prefix)) return;
    const args = message.content.slice(prefix.length).trim().split(/ +/g);
    const command = args.shift().toLowerCase();
    const request = args.join(' ');

    // Command to PLAY music
    if (command === 'play' || command === 'sing') {
      message.delete();
      if (!message.member.voice.channel) {
        return message.channel.send(
          'You must be in a voice channel to use this command!'
        );
      }

      if (request == null || request == '') return;

      console.log(
        `"Play" request from ${message.author.username}#${message.author.discriminator} (ID: ${message.author.id}) sent in server ${message.guild.name} (ID: ${message.guild.id})`
      );
      console.log(
        `Attempting to queue request "${request}" in ${message.guild.name}`
      );

      await client.DisTube.play(message.member.voice.channel, request, {
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

      let queue = client.DisTube.getQueue(message);
      if (!queue)
        return message.channel.send('There is nothing currently in the queue.');

      queue.songs.length == 1
        ? client.DisTube.stop(message)
        : queue.skip(message);
    }

    // Command to view the QUEUE
    if (command === 'queue') {
      let queue = client.DisTube.getQueue(message);
      if (!queue)
        return message.channel.send('There is nothing currently in the queue.');

      message.channel.send(
        '```' +
          queue.songs
            .map(
              (song, id) =>
                `${id === 0 ? 'Singing:' : `${id}.`} ${song.name} - ${
                  song.formattedDuration
                } [requested by ${
                  song.member.nickname == null
                    ? song.user.username
                    : song.member.nickname
                }]`
            )
            .slice(0, 11)
            .join('\n') +
          `\n\nTotal songs in queue: ${queue.songs.length} (${queue.formattedDuration})` +
          '```'
      );
    }

    // Command to SHUFFLE music
    if (command === 'shuffle') {
      let queue = client.DisTube.getQueue(message);
      if (!queue)
        return message.channel.send('There is nothing currently in the queue.');

      queue.shuffle();
      message.channel.send('The songs in the queue have been shuffled!');
    }

    // Command to REPLACE a song in the queue
    if (command == 'replace') {
      let queue = client.DisTube.getQueue(message);
      if (!queue)
        return message.channel.send('There is nothing currently in the queue.');

      const queueNum = parseFloat(request.split(' ', 1));
      if (isNaN(queueNum) || queueNum < 1 || queue.songs[queueNum] == null)
        return message.channel.send(
          'Please enter a valid queue number! Use the command `-queue` to see the current queue.'
        );

      let { songs } = queue;
      const original = songs[queueNum];
      const replacement = request.slice(2);
      replaceFlag = true;

      await client.DisTube.play(message.member.voice.channel, replacement, {
        member: message.member,
        textChannel: message.channel,
        position: queueNum,
        message
      });

      songs.splice(queueNum + 1, 1);
      queue.textChannel.send({
        embeds: [replaceSongEmbed(original, songs[queueNum])]
      });
      replaceFlag = false;
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
function addSongEmbed(name, url, user, queueNum) {
  return new discord.EmbedBuilder().setColor('#6CBEED').setDescription(
    `Warming up my vocal chords to sing [${name}](${url})
      Current spot in the queue: ${queueNum} [${user}]`
  );
}

// Function to handle the embedded message when a song in the queue is replaced with another
function replaceSongEmbed(oldSong, newSong) {
  return new discord.EmbedBuilder()
    .setColor('#6CBEED')
    .setTitle('Song Replaced Successfully')
    .setDescription(
      `[${oldSong.name}](${oldSong.url})
    has been replaced with
    [${newSong.name}](${newSong.url})`
    );
}

// Events for DisTube functions
client.DisTube.on('initQueue', queue => {
  queue.volume = 100;
})
  .on('playSong', (queue, song) => {
    queue.textChannel.send({
      embeds: [playSongEmbed(song.name, song.url, song.user)]
    });

    console.log(
      `Now playing "${song.name}" in ${song.member.guild.name} (ID: ${song.member.guild.id})`
    );
  })
  .on('addSong', (queue, song) => {
    if (!replaceFlag) {
      queue.textChannel.send({
        embeds: [
          addSongEmbed(song.name, song.url, song.user, queue.songs.length - 1)
        ]
      });
    }
  })
  .on('disconnect', queue => {
    queue.textChannel.send('Have an egg-straordinary day!');
  });

// Events for joining/leaving servers
client
  .on('guildCreate', guild => {
    console.log(
      `Joined new server: ${guild.name} (ID: ${guild.id}). This server has ${guild.memberCount} members!`
    );
  })
  .on('guildDelete', guild => {
    console.log(`Removed from server: ${guild.name} (ID: ${guild.id})`);
  });

client.login(process.env.TOKEN);
