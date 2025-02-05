const discord = require('discord.js');
require('dotenv').config();
const client = new discord.Client({
  intents: ['Guilds', 'GuildMessages', 'GuildVoiceStates', 'MessageContent']
});
const { DisTube } = require('distube');
const { YouTubePlugin } = require('@distube/youtube');
const { SpotifyPlugin } = require('@distube/spotify');
const fs = require('fs');

// DisTube setup
client.DisTube = new DisTube(client, {
  emitNewSongOnly: true,
  emitAddSongWhenCreatingQueue: false,
  emitAddListWhenCreatingQueue: false,
  plugins: [
    new SpotifyPlugin(),
    new YouTubePlugin({
      cookies: JSON.parse(fs.readFileSync('cookies.json'))
    })
  ]
});

client.on('ready', () => {
  console.log(`${client.user.tag} is online!`);
});

// These variables needs to be global so it can be used in events
let replaceFlag = false;
let pushFlag = false;

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
        queue.stop(message);
        queue.voice.leave();
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

      if (queue.songs.length == 1) {
        queue.stop(message);
        queue.voice.leave();
      } else {
        queue.skip(message);
      }
    }

    // Command to view the QUEUE
    if (command === 'queue') {
      if (!message.member.voice.channel)
        return message.channel.send(
          'You must be in a voice channel to use this command!'
        );

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
      if (!message.member.voice.channel)
        return message.channel.send(
          'You must be in a voice channel to use this command!'
        );

      let queue = client.DisTube.getQueue(message);
      if (!queue)
        return message.channel.send('There is nothing currently in the queue.');

      queue.shuffle();
      message.channel.send('The songs in the queue have been shuffled!');
    }

    // Command to REPLACE a song in the queue
    if (command == 'replace') {
      if (!message.member.voice.channel)
        return message.channel.send(
          'You must be in a voice channel to use this command!'
        );

      let queue = client.DisTube.getQueue(message);
      if (!queue)
        return message.channel.send('There is nothing currently in the queue.');

      const queueNum = parseFloat(request.split(' ', 1));
      if (isNaN(queueNum) || queueNum < 1 || queue.songs[queueNum] == null)
        return message.channel.send(
          'Please enter a valid queue number! Use the command `-queue` to see the current queue.'
        );

      const replacement = request.slice(2);
      if (replacement == null || replacement == '') return;
      let { songs } = queue;
      const original = songs[queueNum];
      replaceFlag = true;

      await client.DisTube.play(message.member.voice.channel, replacement, {
        member: message.member,
        textChannel: message.channel,
        position: queueNum,
        message
      });

      songs.splice(queueNum + 1, 1);
      queue.textChannel.send({
        embeds: [replaceSongEmbed(original, songs[queueNum], message.member)]
      });
      replaceFlag = false;
    }

    if (command == 'push') {
      if (!message.member.voice.channel)
        return message.channel.send(
          'You must be in a voice channel to use this command!'
        );

      if (request == null || request == '') return;

      console.log(
        `"Push" request from ${message.author.username}#${message.author.discriminator} (ID: ${message.author.id}) sent in server ${message.guild.name} (ID: ${message.guild.id})`
      );
      console.log(
        `Attempting to queue request "${request}" in ${message.guild.name}`
      );

      pushFlag = true;
      await client.DisTube.play(message.member.voice.channel, request, {
        member: message.member,
        textChannel: message.channel,
        position: 1,
        message
      });
      pushFlag = false;
    }
  } catch (err) {
    console.log(err);
  }
});

// Function to handle the embedded message when a song is played
function playSongEmbed(songName, passedUrl, user) {
  return new discord.EmbedBuilder()
    .setColor('#00adce')
    .setTitle('Now singing')
    .setAuthor({
      name: user.displayName,
      url: passedUrl,
      iconURL: user.displayAvatarURL()
    })
    .setDescription(`[${songName}](${passedUrl})`);
}

// Function to handle the embedded message when a song is added to the queue
function addSongEmbed(songName, passedUrl, user, queueNum) {
  return new discord.EmbedBuilder()
    .setColor('#00c590')
    .setAuthor({
      name: user.displayName,
      url: passedUrl,
      iconURL: user.displayAvatarURL()
    })
    .setDescription(
      `Warming up my vocal chords to sing [${songName}](${passedUrl})`
    )
    .setFooter({ text: `Current spot in the queue: ${queueNum}` });
}

// Function to handle the embedded message when a song in the queue is replaced with another
function replaceSongEmbed(oldSong, newSong, user) {
  return new discord.EmbedBuilder()
    .setColor('#8c65d3')
    .setTitle('Song Replaced Successfully')
    .setAuthor({
      name: user.displayName,
      url: newSong.url,
      iconURL: user.displayAvatarURL()
    })
    .addFields(
      {
        name: 'Replaced',
        value: `[${oldSong.name}](${oldSong.url})`
      },
      {
        name: 'with',
        value: `[${newSong.name}](${newSong.url})`
      }
    );
}

function pushSongEmbed(songName, passedUrl, user) {
  return new discord.EmbedBuilder()
    .setTitle('Song pushed to top of queue')
    .setColor('#8c65d3')
    .setAuthor({
      name: user.displayName,
      url: passedUrl,
      iconURL: user.displayAvatarURL()
    })
    .setDescription(
      `Warming up my vocal chords to sing [${songName}](${passedUrl}) next`
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
    if (!replaceFlag && !pushFlag) {
      queue.textChannel.send({
        embeds: [
          addSongEmbed(song.name, song.url, song.user, queue.songs.length - 1)
        ]
      });
    } else if (pushFlag) {
      queue.textChannel.send({
        embeds: [pushSongEmbed(song.name, song.url, song.user)]
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
