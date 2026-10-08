const config = require('../../config');
const { sendSecurityLog } = require('./logger');

/**
 * İhlal gerçekleştiren kullanıcıyı anında cezalandırır ve yetkilerini alır.
 * @param {import('discord.js').Guild} guild
 * @param {import('discord.js').User|string} userOrId
 * @param {string} reason
 * @param {object} [options]
 * @param {boolean} [options.ban=false] Kullanıcıyı direkt banla
 * @param {boolean} [options.kick=false] Kullanıcıyı sunucudan at
 * @param {boolean} [options.timeout=true] Kullanıcıya timeout at
 */
async function punishUser(guild, userOrId, reason, options = {}) {
  const userId = typeof userOrId === 'string' ? userOrId : userOrId.id;

  try {
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) {
      // Üye sunucuda değilse (veya bulunamadıysa) ve ban istenmişse direkt ID üzerinden banla
      if (options.ban) {
        await guild.bans.create(userId, { reason: `[Piyader RP Güvenlik] ${reason}` }).catch(() => null);
      }
      return;
    }

    // Botun kendi yetkisi ve rol hiyerarşisi kontrolü
    if (!member.manageable) {
      await sendSecurityLog(guild, {
        title: '⚠️ YETKİ YETERSİZ - CEZA UYGULANAMADI',
        description: `Hedef kullanıcının rolü botun rolünden daha yüksek olduğu için ceza uygulanamadı!`,
        severity: 'CRITICAL',
        fields: [
          { name: 'Kullanıcı', value: `<@${userId}> (${userId})`, inline: true },
          { name: 'İhlal Nedeni', value: reason, inline: false },
          { name: 'Gereken Önlem', value: 'Botun rolünü sunucu ayarlarında en üste taşıyınız!', inline: false }
        ]
      });
      return;
    }

    const removedRoleNames = [];

    // 1. Yetkili / Yönetici rollerini ve tüm rolleri al
    try {
      const rolesToRemove = member.roles.cache.filter(role => role.id !== guild.id);
      rolesToRemove.forEach(r => removedRoleNames.push(r.name));

      if (rolesToRemove.size > 0) {
        await member.roles.remove(rolesToRemove, `[Güvenlik İhlali] ${reason}`);
      }
    } catch (err) {
      console.error('[Rol Alma Hatası]', err.message);
    }

    // 2. Karantina rolü tanımlıysa ata
    if (config.quarantineRoleId) {
      await member.roles.add(config.quarantineRoleId, `[Güvenlik Karantinası] ${reason}`).catch(() => null);
    }

    // 3. Kullanıcıya Timeout (İletişim Engeli) uygula (Örn: 24 saat veya maksimum)
    if (options.timeout !== false) {
      // 24 saat = 24 * 60 * 60 * 1000 ms
      await member.timeout(24 * 60 * 60 * 1000, `[Güvenlik İhlali] ${reason}`).catch(() => null);
    }

    // 4. Ban talep edilmişse banla
    if (options.ban) {
      await member.ban({ reason: `[Piyader RP Guard] ${reason}` }).catch(() => null);
    } else if (options.kick) {
      await member.kick(`[Piyader RP Guard] ${reason}`).catch(() => null);
    }

    // 5. Bilgilendirme Logu
    await sendSecurityLog(guild, {
      title: '🚨 TEHDİT ENGELLENDİ & YETKİLER ALINDI',
      description: `Yetkisiz işlem gerçekleştiren kullanıcının yetkileri alındı ve yaptırım uygulandı.`,
      severity: 'CRITICAL',
      executor: member.user,
      fields: [
        { name: 'Cezalandırılan Kullanıcı', value: `<@${userId}> (\`${userId}\`)`, inline: true },
        { name: 'Uygulanan İşlem', value: options.ban ? '🔨 Yasaklandı (Ban)' : (options.kick ? '👢 Atıldı (Kick)' : '🛑 Rolleri Alındı & Karantinaya Alındı'), inline: true },
        { name: 'İhlal Sebebi', value: reason, inline: false },
        { name: 'Alınan Roller', value: removedRoleNames.length > 0 ? removedRoleNames.join(', ').slice(0, 1000) : 'Rol bulunamadı', inline: false }
      ]
    });
  } catch (error) {
    console.error('[punishUser Genel Hatası]', error);
  }
}

module.exports = {
  punishUser
};
