const Discord = require('discord.js');
const { Client, Intents } = Discord;
const client = new Discord.Client({
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MEMBERS,
    Intents.FLAGS.GUILD_MESSAGES
  ]});
const db = require('quick.db');

const xpPerMessage = 10; // XP earned per message
const levelUpThreshold = 100; // XP required to level up
const prefix = 'c!'; // Bot command prefix

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  updateXP(); // Run the XP update function when the bot is ready
});

client.on('message', async (message) => {
  if (message.author.bot || !message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // Handle commands here
  if (command === 'ping') {
    message.channel.send('Pong!');
  }
  else if (command === 'level') {
    const userXP = db.get(`xp_${message.author.id}`) || 0;
    const userLevel = db.get(`level_${message.author.id}`) || 0;
    message.channel.send(`You are currently at level ${userLevel} with ${userXP} XP.`);
  }
  else if (command === 'setlevel') {
    if (!message.member.hasPermission('ADMINISTRATOR')) {
      message.channel.send('Only administrators can use this command.');
      return;
    }

    const targetUser = message.mentions.users.first();
    if (!targetUser) {
      message.channel.send('Please mention a user to set their level.');
      return;
    }

    const newLevel = parseInt(args[0]);
    if (isNaN(newLevel)) {
      message.channel.send('Invalid level. Please provide a valid number.');
      return;
    }

    db.set(`level_${targetUser.id}`, newLevel);
    message.channel.send(`Successfully set the level of ${targetUser} to ${newLevel}.`);
  }
  else if (command === 'help') {
    const helpMessage = `**Available Commands**
    \`c!ping\` - Ping the bot.
    \`c!level\` - Get your current level and XP.
    \`c!setlevel @user level\` - Set the level of a user (Admin only).
    \`c!help\` - Get a list of available commands.`;

    message.channel.send(helpMessage);
  }
  else {
    // Unknown command
    message.channel.send('Unknown command. Use `c!help` to see the available commands.');
  }
});

async function updateXP() {
  while (true) {
    const guilds = client.guilds.cache;
    for (const guild of guilds) {
      const members = guild[1].members.cache;
      for (const member of members) {
        const userXP = db.get(`xp_${member[0]}`) || 0;
        const userLevel = db.get(`level_${member[0]}`) || 0;

        const newXp = userXP + xpPerMessage;
        if (newXp >= levelUpThreshold) {
          db.set(`xp_${member[0]}`, newXp - levelUpThreshold);
          db.set(`level_${member[0]}`, userLevel + 1);
          const user = await guild[1].members.fetch(member[0]);
          user.send(`Congratulations ${user}, you leveled up to level ${userLevel + 1}!`);
        }
        else {
          db.set(`xp_${member[0]}`, newXp);
        }
      }
    }

    await sleep(60000); // Wait for 1 minute before updating XP again
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Retrieve bot token from CLI argument
const botToken = process.argv[2];

// Check if the bot token is provided
if (!botToken) {
  console.error('Bot token not provided as a command-line argument!');
  process.exit(1);
}

// Log in with the bot token
client.login(botToken);
