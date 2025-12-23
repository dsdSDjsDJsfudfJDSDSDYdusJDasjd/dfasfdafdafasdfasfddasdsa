module.exports = {
  // Токен бота Discord - берётся из переменной окружения
  TOKEN: process.env.DISCORD_TOKEN,
  
  // ID сервера для slash-команд (мгновенная регистрация)
  GUILD_ID: process.env.GUILD_ID,
  
  // ID канала где бот будет работать (null = работает везде)
  CHANNEL_ID: null,
  
  // ID администраторов (могут крутить бесконечно и выдавать прокруты)
  ADMIN_IDS: [
    '1319850742034731031',
  ],
  
  // Подарки с шансом выпадения (вес в процентах)
  GIFTS: [
    { name: 'ite Charcoal', emoji: 'ite', weight: 30 },
    { name: '$10 Fist', emoji: '💵', weight: 29 },
    { name: '$30 Fist', emoji: '💰', weight: 25 },
    { name: '$80 Fist', emoji: '💎', weight: 20 },
    { name: '7d Subscription', emoji: '📅', weight: 15 },
    { name: '30d Subscription', emoji: '📆', weight: 7 },
    { name: '90d Subscription', emoji: '🗓️', weight: 4 },
    { name: 'Lifetime Subscription', emoji: '👑', weight: 1 }
  ]
};
