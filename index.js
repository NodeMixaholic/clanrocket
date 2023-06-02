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
  updateXP(); // Run the XP update function when the bot is ready
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

client.on('messageCreate', async (message) => {
  await initMailer()
  //The moderation part
  let perms = message.member.permissions.toArray();
  try {
    let text = `${message.content}`
    //console.log(text)
		let result = await perspe.analyze(text)
		let stringify = JSON.stringify(result)
		let obj = JSON.parse(stringify);
		console.log(stringify);
		if (perms.includes("Administrator")) {
			console.log("ADMIN BYPASS")
		} else {
		if (obj.attributeScores.TOXICITY.summaryScore.value > .8571) {
			if (!message.author.bot) {
        await message.reply("Please don't be toxic. :-)");
        message.delete();
      }
		}
		}
	} catch {
		console.log("cant understand!")
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
        from: '"URL Generator (ClanVert)" <clanvert@example.com>', // sender address
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

    const newLevel = parseInt(args[0]);
    if (isNaN(newLevel)) {
      message.channel.send('Invalid level. Please provide a valid number.');
      return;
    }
    await asyncSleep(3000)
    await db.set(`level_${message.guild.id}_${targetUser.id}`, newLevel);
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
      const userXP = db.get(`xp_${guild.id}_${member[0]}`) || 0;
      const userLevel = db.get(`level_${guild.id}_${member[0]}`) || 0;

      const newXp = userXP + xpPerMessage;
      if (newXp >= levelUpThreshold) {
        db.set(`xp_${guild.id}_${member[0]}`, newXp - levelUpThreshold);
        db.set(`level_${guild.id}_${member[0]}`, userLevel + 1);
        const user = await guild[1].members.fetch(member[0]);
        user.send(`Congratulations ${user}, you leveled up to level ${userLevel + 1}!`);
      }
      else {
        db.set(`xp_${guild.id}_${member[0]}`, newXp);
      }
    }
  }

  setTimeout(updateXP, 1)
}


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
