const config = require('../../config');
const { sendSecurityLog } = require('./logger');
const { safeExecute } = require('./safeExecute');
const { recordViolation, logEvent } = require('../memory/memoryManager');

/**
 * İhlal gerçekleştiren kullanıcıyı cezalandırır, hafızaya işler ve yaptırım uygular.
 * @param {import('discord.js').Guild} guild
 * @param {import('discord.js').User|string} userOrId
 * @param {string} reason İhlal gerekçesi
 * @param {object} [options]
 * @param {boolean} [options.ban=false] Doğrudan yasakla (Kritik nuke suçları)
 * @param {boolean} [options.kick=false] Sunucudan at
 * @param {boolean} [options.timeout=true] Susturma uygula
 * @param {string} [options.eventType='SECURITY_VIOLATION']
 */
async function punishUser(guild, userOrId, reason, options = {}) {
  const userId = typeof userOrId === 'string' ? userOrId : userOrId.id;
  const username = typeof userOrId === 'object' && userOrId.tag ? userOrId.tag : `User-${userId}`;

  try {
    // 1. Üyeyi güvenle getir
    const memberFetchResult = await safeExecute(
      () => guild.members.fetch(userId),
      `Fetch Member (${userId})`
    );
    const member = memberFetchResult.success ? memberFetchResult.data : null;

    // 2. Kademeli Ceza / Hafıza Sistemi
    let shouldBan = options.ban || false;
    let shouldKick = options.kick || false;
    let shouldQuarantine = false;
    let timeoutMinutes = config.limits.timeoutDurationMinutes || 10;

    // Sabıka kaydını işle ve strike sayısını al
    const violationInfo = recordViolation(userId, username, reason, options.ban ? 'BAN' : 'PENALTY');
    const strike = violationInfo.violationCount;

    // Kademeli ceza kuralları (Eğer doğrudan kritik ban istenmemişse)
    if (!shouldBan && config.escalatingPenalties && config.escalatingPenalties.enabled) {
      if (strike === 1) {
        timeoutMinutes = 15;
      } else if (strike === 2) {
        shouldQuarantine = true;
        timeoutMinutes = 60 * 24; // 24 saat
      } else if (strike >= 3) {
        shouldBan = true; // 3. İhlalde kalıcı ban
      }
    }

    // 3. Eğer üye sunucuda değilse ve ban gerekiyorsa ID üzerinden banla
    if (!member) {
      if (shouldBan) {
        await safeExecute(
          () => guild.bans.create(userId, { reason: `[Piyader RP Güvenlik] ${reason} (Strike ${strike})` }),
          `Direct Ban (${userId})`
        );
      }
      logEvent({
        eventType: options.eventType || 'SECURITY_VIOLATION',
        severity: shouldBan ? 'CRITICAL' : 'WARNING',
        executorId: userId,
        executorTag: username,
        details: `${reason} (Strike ${strike})`,
        actionTaken: shouldBan ? 'Offline Ban' : 'Kayıt Alındı',
        success: true
      });
      return;
    }

    // 4. Botun rol hiyerarşisi kontrolü
    if (!member.manageable) {
      await sendSecurityLog(guild, {
        title: '⚠️ YETKİ YETERSİZ - CEZA UYGULANAMADI',
        description: `Kullanıcının rolü güvenlik botunun rolünden üstte veya eşit olduğu için işlem engellendi!`,
        severity: 'CRITICAL',
        fields: [
          { name: 'Kullanıcı', value: `<@${userId}> (\`${userId}\`)`, inline: true },
          { name: 'İhlal Sayısı (Strike)', value: `\`${strike}\``, inline: true },
          { name: 'İhlal Sebebi', value: reason, inline: false },
          { name: 'Gereken Önlem', value: 'Discord ayarlarında Güvenlik Botunun rolünü en üste taşıyınız!', inline: false }
        ]
      });
      return;
    }

    const removedRoleNames = [];

    // 5. Rolleri Güvenle Al (Eğer strike >= 2 veya ban gerekiyorsa)
    if (shouldBan || shouldQuarantine || strike >= 2) {
      const rolesToRemove = member.roles.cache.filter(role => role.id !== guild.id);
      rolesToRemove.forEach(r => removedRoleNames.push(r.name));

      if (rolesToRemove.size > 0) {
        await safeExecute(
          () => member.roles.remove(rolesToRemove, `[Piyader RP Güvenlik] ${reason} (Strike ${strike})`),
          `Remove Roles (${userId})`
        );
      }
    }

    // 6. Karantina Rolü Ata
    if ((shouldQuarantine || config.quarantineRoleId) && config.quarantineRoleId) {
      await safeExecute(
        () => member.roles.add(config.quarantineRoleId, `[Güvenlik Karantinası] ${reason}`),
        `Assign Quarantine (${userId})`
      );
    }

    // 7. Timeout (İletişim Engeli)
    if (!shouldBan && !shouldKick && options.timeout !== false) {
      await safeExecute(
        () => member.timeout(timeoutMinutes * 60 * 1000, `[Piyader RP Güvenlik] ${reason} (Strike ${strike})`),
        `Apply Timeout (${userId})`
      );
    }

    // 8. Ban veya Kick
    let actionLabel = `🛑 Timeout (${timeoutMinutes} dk) [Strike ${strike}]`;
    if (shouldBan) {
      actionLabel = `🔨 Kalıcı Yasaklama (Ban) [Strike ${strike}]`;
      await safeExecute(
        () => member.ban({ reason: `[Piyader RP Güvenlik] ${reason} (Strike ${strike})` }),
        `Ban Member (${userId})`
      );
    } else if (shouldKick) {
      actionLabel = `👢 Sunucudan Atma (Kick) [Strike ${strike}]`;
      await safeExecute(
        () => member.kick(`[Piyader RP Güvenlik] ${reason} (Strike ${strike})`),
        `Kick Member (${userId})`
      );
    }

    // 9. Hafızaya Kalıcı Kayıt İşle
    logEvent({
      eventType: options.eventType || 'SECURITY_VIOLATION',
      severity: shouldBan ? 'CRITICAL' : 'DANGER',
      executorId: userId,
      executorTag: username,
      details: `${reason} - Toplam Sabıka İhlali: ${strike}`,
      actionTaken: actionLabel,
      success: true
    });

    // 10. Discord Log Kanalına Bildir
    await sendSecurityLog(guild, {
      title: shouldBan ? '🚨 SALDIRGAN YASAKLANDI' : '🛑 KULLANICIYA YAPTIRIM UYGULANDI',
      description: `Kural ihlali tespit edildi. Olay kalıcı hafızaya işlendi ve ceza uygulandı.`,
      severity: shouldBan ? 'CRITICAL' : 'DANGER',
      executor: member.user,
      fields: [
        { name: 'Kullanıcı', value: `<@${userId}> (\`${userId}\`)`, inline: true },
        { name: 'Toplam İhlal (Strike)', value: `\`${strike}. İhlal\``, inline: true },
        { name: 'Uygulanan İşlem', value: actionLabel, inline: true },
        { name: 'İhlal Gerekçesi', value: reason, inline: false },
        { name: 'Alınan Roller', value: removedRoleNames.length > 0 ? removedRoleNames.join(', ').slice(0, 900) : 'Yok', inline: false }
      ]
    });
  } catch (error) {
    console.error('[punishUser Beklenmeyen Hata]', error);
  }
}

module.exports = {
  punishUser
};
