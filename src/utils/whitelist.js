const config = require('../../config');

/**
 * Piyade RP Ekosistemindeki Bilinen Sabit Bot ID'leri
 * .env dosyası boş olsa dahi bu botlar doğrudan güvenli kabul edilir.
 */
const KNOWN_ECOSYSTEM_BOTS = [
  '1544144846875267253', // Ana Bot (piyade.rp.bot)
  '1557037486478467136', // Müzik Botu (piyade.rp.music.bot)
  '1557030714518540301', // Sistem/Kontrol Botu (piyade.rp.bot.1)
];

/**
 * Bir kullanıcının, yetkilinin veya ekosistem botunun güvenlik korumalarından
 * muaf (whitelist) olup olmadığını denetler.
 * @param {import('discord.js').GuildMember|import('discord.js').User} target
 * @param {import('discord.js').Guild} guild
 * @returns {Promise<boolean>}
 */
async function isWhitelisted(target, guild) {
  if (!target || !guild) return false;

  const userId = target.id;

  // 0. Ekosistemdeki bilinen sabit botlar (piyade.rp.bot, müzik, server check)
  if (KNOWN_ECOSYSTEM_BOTS.includes(userId)) return true;

  // 1. Güvenlik Botunun kendisi
  if (guild.client.user.id === userId) return true;

  // 2. Sunucu Sahibi her zaman tam dokunulmazdır
  if (guild.ownerId === userId) return true;

  // 3. Config'de tanımlı ana bot sahibi
  if (config.ownerId && config.ownerId === userId) return true;

  // 4. Doğrudan güvenli kullanıcı ID listesinde mi?
  if (config.whitelistedUsers && config.whitelistedUsers.includes(userId)) return true;

  // 5. Doğrudan güvenli EKOSİSTEM BOTU ID listesinde mi? (config veya .env)
  if (config.whitelistedBots && config.whitelistedBots.includes(userId)) return true;

  // 6. Whitelist rollerinden birine sahip mi?
  let member = guild.members.cache.get(userId);
  if (!member && guild.members.fetch) {
    // Cache'de bulunamazsa asenkron olarak Discord API'sinden çek
    try {
      member = await guild.members.fetch(userId);
    } catch (e) {
      member = null;
    }
  }

  if (member && member.roles && member.roles.cache) {
    const hasWhitelistedRole = config.whitelistedRoles.some(roleId =>
      member.roles.cache.has(roleId)
    );
    if (hasWhitelistedRole) return true;
  }

  return false;
}

/**
 * Bir botun sunucuya girmesine izin verilip verilmediğini kontrol eder.
 * @param {import('discord.js').User|import('discord.js').GuildMember} botUser
 * @returns {boolean}
 */
function isBotWhitelisted(botUser) {
  if (!botUser) return false;
  if (KNOWN_ECOSYSTEM_BOTS.includes(botUser.id)) return true;
  return config.whitelistedBots && config.whitelistedBots.includes(botUser.id);
}

module.exports = {
  KNOWN_ECOSYSTEM_BOTS,
  isWhitelisted,
  isBotWhitelisted
};
