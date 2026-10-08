const { AuditLogEvent } = require('discord.js');
const { isWhitelisted } = require('../utils/whitelist');
const { getLatestAuditLog } = require('../utils/audit');
const { punishUser } = require('../utils/punisher');
const { sendSecurityLog } = require('../utils/logger');
const config = require('../../config');

/**
 * Sunucu Ayarları ve Vanity URL Koruması
 * @param {import('discord.js').Client} client
 */
module.exports = function guildGuard(client) {
  client.on('guildUpdate', async (oldGuild, newGuild) => {
    if (config.guildId && newGuild.id !== config.guildId) return;

    const entry = await getLatestAuditLog(newGuild, AuditLogEvent.GuildUpdate);
    if (!entry || !entry.executor) return;

    const executor = entry.executor;
    if (isWhitelisted(executor, newGuild)) return;

    console.warn(`[GÜVENLİK İHLALİ] Yetkisiz sunucu ayarı değiştirildi by ${executor.tag}`);

    // Ayarları eski haline döndür
    try {
      if (oldGuild.name !== newGuild.name) {
        await newGuild.setName(oldGuild.name, '[Piyader RP Güvenlik] Yetkisiz sunucu adı değişikliği geri alındı');
      }
      if (oldGuild.icon !== newGuild.icon) {
        await newGuild.setIcon(oldGuild.iconURL(), '[Piyader RP Güvenlik] Yetkisiz ikon değişikliği geri alındı');
      }
      if (oldGuild.banner !== newGuild.banner) {
        await newGuild.setBanner(oldGuild.bannerURL(), '[Piyader RP Güvenlik] Yetkisiz banner değişikliği geri alındı');
      }
    } catch (err) {
      console.error('[Sunucu Ayarı Geri Alma Hatası]', err.message);
    }

    // Cezalandır
    await punishUser(newGuild, executor, `Yetkisiz sunucu ayarları düzenleme eylemi`, { ban: true });

    await sendSecurityLog(newGuild, {
      title: '🚨 SUNUCU AYARLARI TAHRİFATI ENGELLENDİ',
      description: `Yetkisiz bir kullanıcı sunucu adı/ikonu gibi kritik ayarları değiştirmeye çalıştı. Değişiklikler geri alındı ve saldırgan yasaklandı.`,
      severity: 'CRITICAL',
      executor: executor,
      fields: [
        { name: 'Eski İsim', value: `\`${oldGuild.name}\``, inline: true },
        { name: 'Yeni İsim', value: `\`${newGuild.name}\``, inline: true }
      ]
    });
  });
};
