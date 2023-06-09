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
const electron = require("electron")
const nodemailer = require("nodemailer");
const Perspective = require("perspective-api-client")

let testingMode = true

let perspectiveKey = process.argv[3];

if (!perspectiveKey) {
  perspectiveKey = process.argv[2];
  testingMode = false
  if (!perspectiveKey) {
    console.error("Can not find perspective key as command line arg.")
    process.exit(1);
  }
}

let perspe = new Perspective({apiKey: perspectiveKey});
const db = new QuickDB();

const xpPerMessage = 10; // XP earned per message
const levelUpThreshold = 100; // XP required to level up
const prefix = 'c!'; // Bot command prefix

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

function asyncSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
let testAccount;
let transporter
async function initMailer() {
  testAccount = await nodemailer.createTestAccount();
  transporter = nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: testAccount.user, // generated ethereal user
      pass: testAccount.pass, // generated ethereal password
    },
  });
}


//Init moderation.
async function moderate(message) {
  let perms = message.member.permissions.toArray();
  try {
    let text = `${message.content}`
    //console.log(text)
		let result = await perspe.analyze(text, {"attributes": ["TOXICITY", "INSULT", "INCOHERENT", "SPAM", "THREAT"]})
		let stringify = JSON.stringify(result)
		let obj = JSON.parse(stringify);
		console.log(stringify);
		if (perms.includes("Administrator" || message.author.bot)) {
			console.log("ADMIN/BOT BYPASS")
		} else {
		if (obj.attributeScores.TOXICITY.summaryScore.value > .8571 || obj.attributeScores.INSULT.summaryScore.value > .8571 || obj.attributeScores.THREAT.summaryScore.value > .8571) {
        console.log("Reply1")
        await message.reply("Please don't be toxic. :-)");
        console.log("Del1")
        message.delete();
		} else if (obj.attributeScores.INCOHERENT.summaryScore.value > .9321 || obj.attributeScores.SPAM.summaryScore.value > .8571) {
      if (!text.toLowerCase().includes("roblox")) {
        console.log("Reply2")
        await message.reply("Please no spam, and please speak normal-ish english. :-)");
        console.log("Del2")
        message.delete();
      }
    }
		}
	} catch {
		console.log("cant understand!")
	}
}

client.on('messageCreate', async (message) => {
  let perms = message.member.permissions.toArray();
  await initMailer()
  //The moderation part
  await moderate(message)

  if (!message.author.bot && !message.content.startsWith(prefix)) {
    let userXP = await db.get(`xp_${message.guild.id}_${message.author.id}`) || 0;
    let userLevel = await db.get(`level_${message.guild.id}_${message.author.id}`) || 0;
    console.log(`${userXP} ${userLevel}`); // Removed "await" as console.log does not return a Promise
    
    let newXp = Number(userXP + xpPerMessage);
    if (newXp >= levelUpThreshold) {
      db.set(`xp_${message.guild.id}_${message.author.id}`, newXp - levelUpThreshold);
      db.set(`level_${message.guild.id}_${message.author.id}`, userLevel + 1);
      let guild = message.guild; // Added missing "let guild = message.guild"
      let user = await guild.members.fetch(message.author.id);
      user.send(`Congratulations ${user}, you leveled up to level ${userLevel + 1} in ${message.guild.name}!`); // Fixed the variable usage
    }
    else {
      db.set(`xp_${message.guild.id}_${message.author.id}`, newXp);
    }
  }

  //NOTE: PUT CODE THAT'S NOT RELATED TO COMMANDS OR THE BOT SHOULDNT IGNORE ABOVE THIS LINE.
  if (message.author.bot || !message.content.startsWith(prefix)) { return }
  const args = message.content.replaceAll(prefix,"").split(/ +/);
  const command = args[0]
  //console.log(`Command ${command} ran!`)
  // Handle commands here
  if (command === 'ping') {
    message.channel.send('Pong!');
  }
  else if (command == 'genUserInfoLink') {
    if (!args[2] || !args[1]) {
      message.channel.send(`Must define faked URL (be sure to include the / at the end!) as well as the actual *DOMAIN* to redirect to without a protocol. (Protocol in URL must be HTTP[S])`)
      return
    }
    let urlBase = args[1].replaceAll("https://","").replaceAll("http://","").replaceAll("/","⟋")
    let url = `https://${urlBase}@${args[2]}`
    try {
      let info = await transporter.sendMail({
        from: '"URL Generator (ClanRocket)" <clanvertsux@example.com>', // sender address
        to: `test@example.com`, // list of receivers
        subject: "Hello, your URL is ready. ✔", // Subject line
        text: `Your URL is here! It is ${url} ! Enjoy.`, // plain text body
      });
  
      message.channel.send(`Your new link is stored here, it will expire soon! ${nodemailer.getTestMessageUrl(info)}`)
    } catch {
      message.channel.send("An error occured! Please try later. (Attempting auto-repair stetps...)")
      testAccount = await nodemailer.createTestAccount();
    }
  }
  else if (command === 'level') {
    const userXP = await db.get(`xp_${message.guild.id}_${message.author.id}`) || 0;
    const userLevel = await db.get(`level_${message.guild.id}_${message.author.id}`) || 0;
    await asyncSleep(3000)
    message.channel.send(`You are currently at level ${userLevel} with ${userXP} XP.`);
  }
  else if (command === 'setlevel') {
    
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

    const newLevel = Number(parseInt(args[2]));
    console.log(newLevel)
    if (isNaN(newLevel)) {
      message.channel.send('Invalid level. Please provide a valid number.');
      return;
    }
    await asyncSleep(3000)
    await db.set(`level_${message.guild.id}_${targetUser.id}`, newLevel);
    message.channel.send(`Successfully set the level of ${targetUser} to ${newLevel}.`);
    } else if (command === 'setxp') {
    
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

      const newxp = Number(parseInt(args[2]));
      console.log(newxp)
      if (isNaN(newxp)) {
        message.channel.send('Invalid xp. Please provide a valid number.');
        return;
      }
      await asyncSleep(3000)
      await db.set(`xp_${message.guild.id}_${targetUser.id}`, newxp);
      message.channel.send(`Successfully set the level of ${targetUser} to ${newxp}.`);
  }
  else if (command === 'help') {
    const helpMessage = `**Available Commands**
    \`c!ping\` - Ping the bot.
    \`c!level\` - Get your current level and XP.
    \`c!setlevel @user level\` - Set the level of a user (Admin only).
    \`c!setxp @user xp\` - Set the xp of a user (Admin only).
    \`c!help\` - Get a list of available commands.`;

    message.channel.send(helpMessage);
  }
  else {
    // Unknown command
    message.channel.send('Unknown command. Use `c!help` to see the available commands.');
  }

});

client.on('messageUpdate', async (oldMessage, newMessage) => {
  await moderate(newMessage)
})

// Retrieve bot token from CLI argument
let botToken = process.argv[2];

// Check if the bot token is provided
if (!botToken) {
  botToken = process.argv[1];
  testingMode = false
  if (!botToken) {
    console.error('Bot token not provided as a command-line argument!');
    process.exit(1);
  }
}

// Log in with the bot token
client.login(botToken);
