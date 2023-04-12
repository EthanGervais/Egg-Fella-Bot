const discord = require('discord.js');
require('dotenv').config();
const client = new discord.Client({
  intents: ['Guilds', 'GuildMessages', 'GuildVoiceStates', 'MessageContent']
});
const { DisTube } = require('distube');
const { SpotifyPlugin } = require('@distube/spotify');

let marcelSwitch = false;

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

// Regular message replies
client.on('messageCreate', async message => {
  try {
    if (message.author.bot || !message.guild) return;

    // Command to flip the Marcel switch
    if (message.content.toLowerCase().includes('marcel')) {
      marcelSwitch = !marcelSwitch;
      console.log(`The Marcel switch has been set to ${marcelSwitch}`);
    }

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

      // Change Marcel's request to something else
      if (message.author.id === '548539185007558666' && marcelSwitch) {
        const marcelRequests = [
          'never gonna give you up',
          'gummy bear audio',
          'barbie girl aqua audio',
          'among us trap remix',
          'friday rebecca black',
          'minecraft style lyrics',
          'https://www.youtube.com/watch?v=dSDBr0WjrwQ', // MrBeast reading bee movie script
          'the hampsterdance song'
        ];
        const randomChoice = Math.floor(Math.random() * 8);

        console.log(
          `Attempting to queue request the goofy Marcel request "${marcelRequests[randomChoice]}" in ${message.guild.name}`
        );

        await client.DisTube.play(
          message.member.voice.channel,
          marcelRequests[randomChoice],
          {
            member: message.member,
            textChannel: message.channel,
            message
          }
        );
      } else {
        // Regular request logic
        console.log(
          `"Play" request from ${message.author.username}#${message.author.discriminator} (ID: ${message.author.id}) sent in server ${message.guild.name} (ID: ${message.guild.id})`
        );
        console.log(
          `Attempting to play request "${request}" in ${message.guild.name}`
        );

        await client.DisTube.play(message.member.voice.channel, request, {
          member: message.member,
          textChannel: message.channel,
          message
        });
      }
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
        message.channel.send('Have an egg-cellent day!');
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
        return message.channel.send('There is nothing currently in the queue');

      queue.songs.length == 1
        ? client.DisTube.stop(message)
        : queue.skip(message);
    }

    // Command to view the QUEUE
    if (command === 'queue') {
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
        return message.channel.send('There is nothing currently in the queue');

      queue.shuffle();
      message.channel.send('The songs in the queue have been shuffled!');
    }

    // Command to check the status of the Marcel switch
    if (command === 'switchstatus') {
      message.channel.send(`The switch is currently set to: ${marcelSwitch}`);
      console.log(`The Marcel switch is currently set to: ${marcelSwitch}`);
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
  .on('playSong', (queue, song) => {
    queue.textChannel.send({
      embeds: [playSongEmbed(song.name, song.url, song.user)]
    });

    console.log(
      `Now playing "${song.name}" in ${song.member.guild.name} (ID: ${song.member.guild.id})`
    );
  })
  .on('addSong', (queue, song) => {
    queue.textChannel.send({
      embeds: [addSongEmbed(song.name, song.url, song.user)]
    });
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
