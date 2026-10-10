const { AuditLogEvent } = require('discord.js');
const { isWhitelisted } = require('../utils/whitelist');
const { getLatestAuditLog } = require('../utils/audit');
const { punishUser } = require('../utils/punisher');
const { sendSecurityLog } = require('../utils/logger');
const { safeExecute } = require('../utils/safeExecute');
const config = require('../../config');

/**
 * Üye Ban & Kick Koruması Modülü
 * @param {import('discord.js').Client} client
 */
module.exports = function memberGuard(client) {
  // 1. BAN KORUMASI (Mass Ban / Yetkisiz Ban)
  client.on('guildBanAdd', async ban => {
    if (!ban.guild || (config.guildId && ban.guild.id !== config.guildId)) return;
    const guild = ban.guild;

    const entry = await getLatestAuditLog(guild, AuditLogEvent.MemberBanAdd, ban.user.id);
    if (!entry || !entry.executor) return;

    const executor = entry.executor;
    if (await isWhitelisted(executor, guild)) return;

    console.warn(`[GÜVENLİK İHLALİ] Yetkisiz ban atıldı: ${ban.user.tag} by ${executor.tag}`);

    // Banlayan kişiyi cezalandır & Hafızaya Yaz
    await punishUser(guild, executor, `Yetkisiz üye banlama: ${ban.user.tag}`, {
      ban: true,
      eventType: 'UNAUTHORIZED_BAN'
    });

    // Haksız banlanan üyenin banını güvenle aç
    await safeExecute(
      () => guild.bans.remove(ban.user.id, '[Piyader RP Güvenlik] Haksız ban otomatik kaldırıldı'),
      `Unban Victim (${ban.user.id})`
    );

    await sendSecurityLog(guild, {
      title: '🚨 YETKİSİZ BAN SALDIRISI ENGELLENDİ',
      description: `Yetkisiz bir kullanıcı sunucudan üye yasakladı! Saldırgan yasaklandı ve mağdurun yasağı kaldırıldı.`,
      severity: 'CRITICAL',
      executor: executor,
      fields: [
        { name: 'Yasaklanan Üye', value: `${ban.user.tag} (\`${ban.user.id}\`)`, inline: true },
        { name: 'Saldırgan', value: `<@${executor.id}> (\`${executor.id}\`)`, inline: true },
        { name: 'Alınan Önlem', value: 'Saldırgan yasaklandı, üyenin banı açıldı.', inline: false }
      ]
    });
  });

  // 2. KICK KORUMASI (Mass Kick / Yetkisiz Kick)
  client.on('guildMemberRemove', async member => {
    if (!member.guild || (config.guildId && member.guild.id !== config.guildId)) return;
    const guild = member.guild;

    const entry = await getLatestAuditLog(guild, AuditLogEvent.MemberKick, member.id);
    if (!entry || !entry.executor) return;

    const executor = entry.executor;
    if (await isWhitelisted(executor, guild)) return;

    console.warn(`[GÜVENLİK İHLALİ] Yetkisiz kick atıldı: ${member.user.tag} by ${executor.tag}`);

    // Kickleyen kişiyi cezalandır
    await punishUser(guild, executor, `Yetkisiz üye atma (Kick): ${member.user.tag}`, {
      ban: true,
      eventType: 'UNAUTHORIZED_KICK'
    });

    await sendSecurityLog(guild, {
      title: '🚨 YETKİSİZ KICK SALDIRISI ENGELLENDİ',
      description: `Yetkisiz bir kullanıcı sunucudan üye attı! Saldırgan yasaklandı / yetkileri çekildi.`,
      severity: 'CRITICAL',
      executor: executor,
      fields: [
        { name: 'Atılan Üye', value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
        { name: 'Saldırgan', value: `<@${executor.id}> (\`${executor.id}\`)`, inline: true }
      ]
    });
  });
};
