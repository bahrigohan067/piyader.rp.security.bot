const config = require('../../config');

/**
 * Bir kullanıcının veya üyenin güvenlik korumalarından muaf (whitelist) olup olmadığını denetler.
 * @param {import('discord.js').GuildMember|import('discord.js').User} target
 * @param {import('discord.js').Guild} guild
 * @returns {boolean}
 */
function isWhitelisted(target, guild) {
  if (!target) return false;

  const userId = target.id;

  // 1. Botun kendisi
  if (guild.client.user.id === userId) return true;

  // 2. Sunucu Sahibi her zaman tam muaftır
  if (guild.ownerId === userId) return true;

  // 3. Config'de tanımlı ana bot sahibi
  if (config.ownerId && config.ownerId === userId) return true;

  // 4. Doğrudan güvenli kullanıcı ID listesinde mi?
  if (config.whitelistedUsers.includes(userId)) return true;

  // 5. Eğer bir bot ise ve izinli botlar listesindeyse
  if (target.bot && config.whitelistedBots.includes(userId)) return true;

  // 6. Whitelist rollerinden birine sahip mi?
  // target bir GuildMember mı yoksa User mı kontrol edelim
  const member = guild.members.cache.get(userId);
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
  return config.whitelistedBots.includes(botUser.id);
}

module.exports = {
  isWhitelisted,
  isBotWhitelisted
};
