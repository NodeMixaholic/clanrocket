const { PermissionsBitField, Client, Intents, GatewayIntentBits } = require('discord.js');

const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ]
});

const { QuickDB } = require("quick.db");
const db = new QuickDB();

const xpPerMessage = 10; // XP earned per message
const levelUpThreshold = 100; // XP required to level up
const prefix = 'c!'; // Bot command prefix

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  updateXP(); // Run the XP update function when the bot is ready
});

function asyncSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.content.startsWith(prefix)) return;

  const args = message.content.replaceAll(prefix,"").split(/ +/);
  const command = args[0]
  //console.log(`Command ${command} ran!`)
  // Handle commands here
  if (command === 'ping') {
    message.channel.send('Pong!');
  }
  else if (command === 'level') {
    const userXP = await db.get(`xp_${message.author.id}`) || 0;
    const userLevel = await db.get(`level_${message.author.id}`) || 0;
    await asyncSleep(3000)
    message.channel.send(`You are currently at level ${userLevel} with ${userXP} XP.`);
  }
  else if (command === 'setlevel') {
    let perms = message.member.permissions.toArray();
    //console.log(`${perms}`)
    if (!perms.includes("Administrator")) {
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
    await asyncSleep(3000)
    await db.set(`level_${targetUser.id}`, newLevel);
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

  setTimeout(updateXP, 15000)
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
