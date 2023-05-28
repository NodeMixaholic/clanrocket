const Discord = require('discord.js');
const client = new Discord.Client();
const db = require('quick.db');

const xpPerMessage = 10; // XP earned per message
const levelUpThreshold = 100; // XP required to level up

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('message', (message) => {
  if (message.author.bot) return;

  // Get user's current XP and level from the database
  let userXP = db.get(`xp_${message.author.id}`) || 0;
  let userLevel = db.get(`level_${message.author.id}`) || 0;

  // Calculate new XP and check for level up
  let newXp = userXP + xpPerMessage;
  if (newXp >= levelUpThreshold) {
    newXp -= levelUpThreshold;
    userLevel += 1;
    message.channel.send(`Congratulations ${message.author}, you leveled up to level ${userLevel}!`);
  }

  // Store updated XP and level in the database
  db.set(`xp_${message.author.id}`, newXp);
  db.set(`level_${message.author.id}`, userLevel);
});

// Retrieve bot token from CLI argument
const botToken = process.argv[2];

// Check if the bot token is provided
if (!botToken) {
  console.error('Bot token not provided as a command-line argument!');
  process.exit(1);
}

// Log in with the bot token
client.login(botToken);
