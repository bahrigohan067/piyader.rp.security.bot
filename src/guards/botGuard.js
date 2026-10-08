const { AuditLogEvent } = require('discord.js');
const { isWhitelisted, isBotWhitelisted } = require('../utils/whitelist');
const { getLatestAuditLog } = require('../utils/audit');
const { punishUser } = require('../utils/punisher');
const { sendSecurityLog } = require('../utils/logger');
const config = require('../../config');

/**
 * İzinsiz / Zararlı Bot Ekleme Koruması (Anti-Bot Guard)
 * @param {import('discord.js').Client} client
 */
module.exports = function botGuard(client) {
  client.on('guildMemberAdd', async member => {
    if (!member.guild || (config.guildId && member.guild.id !== config.guildId)) return;
    if (!member.user.bot) return; // Sadece botları denetle

    const guild = member.guild;

    // Eğer bot önceden onaylı botlar listesindeyse izin ver
    if (isBotWhitelisted(member.user)) {
      console.log(`[Güvenli Bot Girişi] ${member.user.tag} güvenli bot listesinde olduğu için izin verildi.`);
      return;
    }

    // Botu kimin eklediğini bulmak için Audit Log sorgula
    const entry = await getLatestAuditLog(guild, AuditLogEvent.BotAdd, member.id);
    const executor = entry ? entry.executor : null;

    // Eğer ekleyen kişi whitelist'te ise izin ver
    if (executor && isWhitelisted(executor, guild)) {
      console.log(`[Yetkili Bot Girişi] ${member.user.tag} botu yetkili (${executor.tag}) tarafından eklendi.`);
      return;
    }

    console.warn(`[GÜVENLİK İHLALİ] İzinsiz bot eklendi: ${member.user.tag}`);

    // 1. Eklenen botu anında yasakla
    await member.ban({ reason: '[Piyader RP Güvenlik] İzinsiz bot girişi engellendi' }).catch(err => {
      console.error('[Bot Ban Hatası]', err.message);
    });

    // 2. Botu ekleyen kullanıcıyı cezalandır
    if (executor) {
      await punishUser(guild, executor, `İzinsiz bot ekleme eylemi: ${member.user.tag}`, { ban: true });
    }

    await sendSecurityLog(guild, {
      title: '🚨 İZİNSİZ BOT GİRİŞİ ENGELLENDİ',
      description: `Sunucuya izinsiz bir bot eklenmeye çalışıldı! Bot yasaklandı ve ekleyen yetkili cezalandırıldı.`,
      severity: 'CRITICAL',
      executor: executor,
      fields: [
        { name: 'Engellenen Bot', value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
        { name: 'Botu Ekleyen', value: executor ? `<@${executor.id}> (\`${executor.tag}\`)` : 'Tespit edilemedi', inline: true },
        { name: 'Alınan Önlem', value: 'Bot anında banlandı, ekleyen kişinin tüm yetkileri feshedildi.', inline: false }
      ]
    });
  });
};
