const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, REST, Routes, PermissionFlagsBits, ChannelType } = require('discord.js');
const fs = require('fs');
const path = require('path');
const http = require('http');
const config = require('./config');

// HTTP сервер для Render (keep-alive)
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is running!');
}).listen(PORT, () => {
  console.log(`🌐 HTTP сервер запущен на порту ${PORT}`);
});

// ID канала для пинга (keep-alive)
const PING_CHANNEL_ID = '1452706903036526797';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Отслеживание новых постов на форуме через messageCreate
async function handleForumPost(message) {
  // Проверяем что это первое сообщение в треде форума
  if (!message.channel.isThread()) return;
  if (message.channel.parentId !== FORUM_CHANNEL_ID) return;
  
  // Проверяем что это стартовое сообщение треда
  const thread = message.channel;
  if (message.id !== thread.id) return; // В форумах ID треда = ID первого сообщения
  
  const sellerId = message.author.id;
  const guild = message.guild;
  
  // Проверяем, не создан ли уже канал для этого треда
  const deals = loadDeals();
  if (deals[thread.id]) return;
  
  try {
    // Создаём приватный канал для сделки
    const privateChannel = await guild.channels.create({
      name: `deal-${thread.name.slice(0, 20)}-${thread.id.slice(-4)}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        {
          id: guild.id, // @everyone
          deny: [PermissionFlagsBits.ViewChannel]
        },
        {
          id: sellerId, // Продавец - полный доступ
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.AddReactions
          ]
        },
        {
          id: client.user.id, // Бот
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ManageChannels
          ]
        }
      ]
    });
    
    // Сохраняем связь
    deals[thread.id] = {
      channelId: privateChannel.id,
      sellerId: sellerId,
      buyers: []
    };
    saveDeals(deals);
    
    // Отправляем приветственное сообщение в приватный канал
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('🔒 Приватный канал сделки')
      .setDescription(`Этот канал создан для объявления: **${thread.name}**\n\nСюда будут добавлены покупатели после оплаты.\n\n📌 [Перейти к объявлению](${thread.url})`)
      .addFields({ name: '👤 Продавец', value: `<@${sellerId}>` })
      .setTimestamp();
    
    await privateChannel.send({ embeds: [embed] });
    
    // Уведомляем продавца в треде
    await thread.send({
      content: `<@${sellerId}>, создан приватный канал для этой сделки: <#${privateChannel.id}>`,
      allowedMentions: { users: [sellerId] }
    });
    
    console.log(`✅ Создан приватный канал для сделки: ${thread.name}`);
  } catch (error) {
    console.error('Ошибка при создании приватного канала:', error);
  }
}

const DATA_FILE = path.join(__dirname, 'user_data.json');
const SPINS_FILE = path.join(__dirname, 'extra_spins.json');
const FISTS_FILE = path.join(__dirname, 'fists_data.json');
const DEALS_FILE = path.join(__dirname, 'deals_data.json');

const FORUM_CHANNEL_ID = '1452692213925417164';

// Загрузка данных о сделках (связь пост -> приватный канал)
function loadDeals() {
  if (fs.existsSync(DEALS_FILE)) {
    return JSON.parse(fs.readFileSync(DEALS_FILE, 'utf8'));
  }
  return {};
}

// Сохранение данных о сделках
function saveDeals(data) {
  fs.writeFileSync(DEALS_FILE, JSON.stringify(data, null, 2));
}

// Проверка админа
function isAdmin(userId) {
  return config.ADMIN_IDS.includes(userId);
}

// Загрузка дополнительных прокрутов
function loadExtraSpins() {
  if (fs.existsSync(SPINS_FILE)) {
    return JSON.parse(fs.readFileSync(SPINS_FILE, 'utf8'));
  }
  return {};
}

// Сохранение дополнительных прокрутов
function saveExtraSpins(data) {
  fs.writeFileSync(SPINS_FILE, JSON.stringify(data, null, 2));
}

// Загрузка баланса фистов
function loadFists() {
  if (fs.existsSync(FISTS_FILE)) {
    return JSON.parse(fs.readFileSync(FISTS_FILE, 'utf8'));
  }
  return {};
}

// Сохранение баланса фистов
function saveFists(data) {
  fs.writeFileSync(FISTS_FILE, JSON.stringify(data, null, 2));
}

// Добавить фисты пользователю (из подарка)
function addFistsFromGift(userId, giftName) {
  const match = giftName.match(/\$(\d+)\s*Fist/i);
  if (match) {
    const amount = parseInt(match[1]);
    const fists = loadFists();
    fists[userId] = (fists[userId] || 0) + amount;
    saveFists(fists);
    return amount;
  }
  return 0;
}

// Загрузка данных пользователей
function loadUserData() {
  if (fs.existsSync(DATA_FILE)) {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  }
  return {};
}

// Сохранение данных пользователей
function saveUserData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Получить текущую дату в формате YYYY-MM-DD
function getTodayDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// Получить время до полуночи
function getTimeUntilMidnight() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setDate(midnight.getDate() + 1);
  midnight.setHours(0, 0, 0, 0);
  
  const diff = midnight - now;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  return { hours, minutes };
}

// Получить подарок с учётом веса (шанса выпадения)
function getRandomGift() {
  const totalWeight = config.GIFTS.reduce((sum, gift) => sum + gift.weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const gift of config.GIFTS) {
    random -= gift.weight;
    if (random <= 0) {
      return gift;
    }
  }
  return config.GIFTS[0];
}

client.once('ready', async () => {
  console.log(`✅ Бот ${client.user.tag} запущен!`);
  
  // Keep-alive пинг каждые 10 минут
  setInterval(async () => {
    try {
      const channel = await client.channels.fetch(PING_CHANNEL_ID);
      if (channel) {
        const msg = await channel.send('🏓 Ping! (keep-alive)');
        await msg.delete().catch(() => {});
        console.log('🏓 Keep-alive ping отправлен');
      }
    } catch (err) {
      console.error('Ошибка keep-alive:', err.message);
    }
  }, 10 * 60 * 1000); // 10 минут
  
  // Автоматически присоединяемся к тредам форума
  try {
    const guild = await client.guilds.fetch(config.GUILD_ID);
    const forumChannel = await guild.channels.fetch(FORUM_CHANNEL_ID);
    if (forumChannel) {
      const threads = await forumChannel.threads.fetch();
      threads.threads.forEach(thread => {
        thread.join().catch(() => {});
      });
      console.log(`✅ Присоединился к ${threads.threads.size} тредам форума`);
    }
  } catch (err) {
    console.error('Ошибка присоединения к тредам:', err);
  }
  
  // Регистрация slash-команд
  const commands = [
    new SlashCommandBuilder()
      .setName('sell')
      .setDescription('Создать объявление о продаже')
      .addStringOption(option =>
        option.setName('item')
          .setDescription('Название товара')
          .setRequired(true))
      .addIntegerOption(option =>
        option.setName('price')
          .setDescription('Цена в Fist')
          .setRequired(true)
          .setMinValue(1))
      .addStringOption(option =>
        option.setName('description')
          .setDescription('Описание товара')
          .setRequired(false))
  ];
  
  const rest = new REST({ version: '10' }).setToken(config.TOKEN);
  
  try {
    await rest.put(
      Routes.applicationGuildCommands(client.user.id, config.GUILD_ID),
      { body: commands }
    );
    console.log('✅ Slash-команды зарегистрированы!');
  } catch (error) {
    console.error('Ошибка регистрации команд:', error);
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  
  // Проверяем посты на форуме
  await handleForumPost(message);
  
  // Команда продажи через текст - работает ВЕЗДЕ
  if (message.content.toLowerCase().startsWith('!sell')) {
    const content = message.content.slice(5).trim();
    const parts = content.split('|').map(p => p.trim());
    
    if (parts.length < 2) {
      return message.reply('❌ Использование: `!sell Название | Цена | Описание (опционально)`\n\nПример: `!sell Редкий скин | 50 | Очень крутой скин`');
    }
    
    const item = parts[0];
    const price = parseInt(parts[1]);
    const description = parts[2] || 'Без описания';
    const sellerId = message.author.id;
    
    if (!item || isNaN(price) || price < 1) {
      return message.reply('❌ Неверный формат! Цена должна быть числом больше 0.\n\nПример: `!sell Редкий скин | 50 | Очень крутой скин`');
    }
    
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`🛒 ${item}`)
      .setDescription(description)
      .addFields(
        { name: '💰 Цена', value: `${price} Fist`, inline: true },
        { name: '👤 Продавец', value: `<@${sellerId}>`, inline: true }
      )
      .setFooter({ text: 'Нажми кнопку Buy чтобы купить' })
      .setTimestamp();
    
    const button = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`buy_${sellerId}_${price}`)
          .setLabel(`Buy for ${price} Fist`)
          .setStyle(ButtonStyle.Success)
          .setEmoji('💵')
      );
    
    return message.reply({ embeds: [embed], components: [button] });
  }
  
  // Проверка канала (если указан) - для остальных команд
  if (config.CHANNEL_ID && message.channel.id !== config.CHANNEL_ID) return;
  
  // Команда открытия календаря
  if (message.content.toLowerCase() === '!advent' || message.content.toLowerCase() === '!календарь') {
    const userId = message.author.id;
    const today = getTodayDate();
    const userData = loadUserData();
    const extraSpins = loadExtraSpins();
    
    // Админы могут крутить бесконечно
    if (isAdmin(userId)) {
      const gift = getRandomGift();
      const fistAmount = addFistsFromGift(userId, gift.name);
      
      const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('👑 Админский прокрут')
        .setDescription(`**${message.author.username}** открывает подарок...\n\n${gift.emoji} **${gift.name}**\n\n_Шанс: ${gift.weight}%_${fistAmount > 0 ? `\n\n💵 **+${fistAmount} Fist** добавлено на баланс!` : ''}`)
        .setTimestamp();
      
      return message.reply({ embeds: [embed] });
    }
    
    // Проверяем, открывал ли пользователь сегодня
    if (userData[userId] === today) {
      // Проверяем дополнительные прокруты
      if (extraSpins[userId] && extraSpins[userId] > 0) {
        extraSpins[userId]--;
        saveExtraSpins(extraSpins);
        
        const gift = getRandomGift();
        const fistAmount = addFistsFromGift(userId, gift.name);
        
        const embed = new EmbedBuilder()
          .setColor(0x9B59B6)
          .setTitle('🎰 Бонусный прокрут!')
          .setDescription(`**${message.author.username}** использует бонусный прокрут...\n\n${gift.emoji} **${gift.name}**\n\n_Шанс: ${gift.weight}%_${fistAmount > 0 ? `\n\n💵 **+${fistAmount} Fist** добавлено на баланс!` : ''}`)
          .addFields({ name: '🎫 Осталось прокрутов', value: `${extraSpins[userId]}`, inline: true })
          .setTimestamp();
        
        return message.reply({ embeds: [embed] });
      }
      
      const timeLeft = getTimeUntilMidnight();
      
      const embed = new EmbedBuilder()
        .setColor(0xFF6B6B)
        .setTitle('⏰ Подожди немного!')
        .setDescription(`Ты уже открывал календарь сегодня!\n\nСледующий подарок будет доступен через:\n**${timeLeft.hours} ч. ${timeLeft.minutes} мин.**\n\n(в 00:00)`)
        .setFooter({ text: 'Адвент-календарь' })
        .setTimestamp();
      
      return message.reply({ embeds: [embed] });
    }
    
    // Открываем подарок
    userData[userId] = today;
    saveUserData(userData);
    
    const gift = getRandomGift();
    const fistAmount = addFistsFromGift(userId, gift.name);
    const openedCount = Object.values(userData).filter(d => d === today).length;
    
    const embed = new EmbedBuilder()
      .setColor(0x00D26A)
      .setTitle('🎄 Адвент-календарь')
      .setDescription(`**${message.author.username}** открывает сегодняшний подарок...\n\n${gift.emoji} **${gift.name}**\n\n_Шанс: ${gift.weight}%_${fistAmount > 0 ? `\n\n💵 **+${fistAmount} Fist** добавлено на баланс!` : ''}`)
      .addFields({ name: '📅 Дата', value: today, inline: true })
      .setFooter({ text: `Сегодня открыли: ${openedCount} чел.` })
      .setTimestamp();
    
    return message.reply({ embeds: [embed] });
  }
  
  // Команда помощи
  if (message.content.toLowerCase() === '!advent-help') {
    const userId = message.author.id;
    const extraSpins = loadExtraSpins();
    const userSpins = extraSpins[userId] || 0;
    
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('📖 Адвент-календарь - Помощь')
      .setDescription('Открывай календарь каждый день и получай подарки!')
      .addFields(
        { name: '!advent или !календарь', value: 'Открыть сегодняшний подарок' },
        { name: '!advent-help', value: 'Показать эту справку' },
        { name: '🎫 Твои бонусные прокруты', value: `${userSpins}` }
      )
      .setFooter({ text: 'Подарок можно открыть 1 раз в день. Обновление в 00:00' });
    
    if (isAdmin(userId)) {
      embed.addFields(
        { name: '👑 Админ-команды', value: '!give-spins @user кол-во\n!give-fists @user кол-во' }
      );
    }
    
    return message.reply({ embeds: [embed] });
  }
  
  // Команда просмотра баланса фистов
  if (message.content.toLowerCase() === '!fist' || message.content.toLowerCase() === '!fists') {
    const userId = message.author.id;
    const fists = loadFists();
    const userFists = fists[userId] || 0;
    
    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle('💵 Баланс Fist')
      .setDescription(`**${message.author.username}**, твой баланс:\n\n💰 **${userFists} Fist**`)
      .setFooter({ text: 'Fist можно получить из адвент-календаря' })
      .setTimestamp();
    
    return message.reply({ embeds: [embed] });
  }
  
  // Админ-команда выдачи прокрутов
  if (message.content.toLowerCase().startsWith('!give-spins')) {
    if (!isAdmin(message.author.id)) {
      return message.reply('❌ У тебя нет прав на эту команду.');
    }
    
    const args = message.content.split(' ');
    const targetUser = message.mentions.users.first();
    const amount = parseInt(args[2]);
    
    if (!targetUser || isNaN(amount) || amount < 1) {
      return message.reply('❌ Использование: `!give-spins @user количество`');
    }
    
    const extraSpins = loadExtraSpins();
    extraSpins[targetUser.id] = (extraSpins[targetUser.id] || 0) + amount;
    saveExtraSpins(extraSpins);
    
    const embed = new EmbedBuilder()
      .setColor(0x00D26A)
      .setTitle('🎫 Прокруты выданы!')
      .setDescription(`**${targetUser.username}** получил **${amount}** бонусных прокрутов!\n\nВсего у него: **${extraSpins[targetUser.id]}**`)
      .setTimestamp();
    
    return message.reply({ embeds: [embed] });
  }
  
  // Админ-команда выдачи фистов
  if (message.content.toLowerCase().startsWith('!give-fists')) {
    if (!isAdmin(message.author.id)) {
      return message.reply('❌ У тебя нет прав на эту команду.');
    }
    
    const args = message.content.split(' ');
    const targetUser = message.mentions.users.first();
    const amount = parseInt(args[2]);
    
    if (!targetUser || isNaN(amount) || amount < 1) {
      return message.reply('❌ Использование: `!give-fists @user количество`');
    }
    
    const fists = loadFists();
    fists[targetUser.id] = (fists[targetUser.id] || 0) + amount;
    saveFists(fists);
    
    const embed = new EmbedBuilder()
      .setColor(0x00D26A)
      .setTitle('💵 Fist выданы!')
      .setDescription(`**${targetUser.username}** получил **${amount} Fist**!\n\nВсего у него: **${fists[targetUser.id]} Fist**`)
      .setTimestamp();
    
    return message.reply({ embeds: [embed] });
  }
});

// Обработка slash-команд
client.on('interactionCreate', async (interaction) => {
  // Обработка команды /sell
  if (interaction.isChatInputCommand() && interaction.commandName === 'sell') {
    const item = interaction.options.getString('item');
    const price = interaction.options.getInteger('price');
    const description = interaction.options.getString('description') || 'Без описания';
    const sellerId = interaction.user.id;
    
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`🛒 ${item}`)
      .setDescription(description)
      .addFields(
        { name: '💰 Цена', value: `${price} Fist`, inline: true },
        { name: '👤 Продавец', value: `<@${sellerId}>`, inline: true }
      )
      .setFooter({ text: 'Нажми кнопку Buy чтобы купить' })
      .setTimestamp();
    
    const button = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`buy_${sellerId}_${price}`)
          .setLabel(`Buy for ${price} Fist`)
          .setStyle(ButtonStyle.Success)
          .setEmoji('💵')
      );
    
    await interaction.reply({ embeds: [embed], components: [button] });
  }
  
  // Обработка кнопки покупки
  if (interaction.isButton() && interaction.customId.startsWith('buy_')) {
    const [, sellerId, priceStr] = interaction.customId.split('_');
    const price = parseInt(priceStr);
    const buyerId = interaction.user.id;
    
    // Нельзя купить у себя
    if (buyerId === sellerId) {
      return interaction.reply({ content: '❌ Ты не можешь купить свой же товар!', ephemeral: true });
    }
    
    const fists = loadFists();
    const buyerBalance = fists[buyerId] || 0;
    
    // Проверка баланса
    if (buyerBalance < price) {
      return interaction.reply({ 
        content: `❌ **Not enough Fist's!**\n\nТебе нужно: **${price} Fist**\nУ тебя есть: **${buyerBalance} Fist**\nНе хватает: **${price - buyerBalance} Fist**`, 
        ephemeral: true 
      });
    }
    
    // Списываем у покупателя, начисляем продавцу
    fists[buyerId] = buyerBalance - price;
    fists[sellerId] = (fists[sellerId] || 0) + price;
    saveFists(fists);
    
    // Добавляем покупателя в приватный канал сделки (если есть)
    const deals = loadDeals();
    const threadId = interaction.channel?.id;
    
    if (threadId && deals[threadId]) {
      const deal = deals[threadId];
      const guild = interaction.guild;
      
      try {
        const privateChannel = await guild.channels.fetch(deal.channelId);
        if (privateChannel) {
          // Добавляем покупателя с правами только на просмотр и реакции
          await privateChannel.permissionOverwrites.create(buyerId, {
            ViewChannel: true,
            SendMessages: false,
            AddReactions: true,
            ReadMessageHistory: true
          });
          
          // Сохраняем покупателя в список
          if (!deal.buyers.includes(buyerId)) {
            deal.buyers.push(buyerId);
            saveDeals(deals);
          }
          
          // Уведомляем в приватном канале
          const buyEmbed = new EmbedBuilder()
            .setColor(0x00D26A)
            .setTitle('💰 Новая покупка!')
            .setDescription(`<@${buyerId}> купил товар за **${price} Fist**`)
            .setTimestamp();
          
          await privateChannel.send({ embeds: [buyEmbed] });
        }
      } catch (err) {
        console.error('Ошибка добавления покупателя в канал:', err);
      }
    }
    
    const embed = new EmbedBuilder()
      .setColor(0x00D26A)
      .setTitle('✅ Покупка успешна!')
      .setDescription(`<@${buyerId}> купил товар у <@${sellerId}>`)
      .addFields(
        { name: '💰 Сумма', value: `${price} Fist`, inline: true },
        { name: '💵 Твой баланс', value: `${fists[buyerId]} Fist`, inline: true }
      )
      .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
  }
});

client.login(config.TOKEN);

// Автоматически присоединяемся к новым тредам
client.on('threadCreate', async (thread) => {
  if (thread.parentId === FORUM_CHANNEL_ID) {
    await thread.join();
    console.log(`✅ Присоединился к новому треду: ${thread.name}`);
  }
});
