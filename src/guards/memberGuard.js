const { AuditLogEvent, PermissionFlagsBits } = require('discord.js');
const { isWhitelisted } = require('../utils/whitelist');
const { getLatestAuditLog } = require('../utils/audit');
const { punishUser } = require('../utils/punisher');
const { sendSecurityLog } = require('../utils/logger');
const { safeExecute } = require('../utils/safeExecute');
const config = require('../../config');

// Yetkili rol silme hız takibi (Brute-Force API Abuse tespiti)
const executorRoleStrippingMap = new Map();
const ROLE_STRIP_LIMIT = 2; // 10 saniyede 2 veya daha fazla rol silme/gasp eylemi
const ROLE_STRIP_WINDOW_MS = 10000;

/**
 * Üye Güvenlik Koruması Modülü (Ban, Kick ve Hızlı Rol Gaspı / Brute-Force Koruması)
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

  // 3. BRUTE-FORCE (API) & ROL GASPI KORUMASI (guildMemberUpdate)
  // Bir üyenin rolleri hızlıca silindiğinde mağduru değil, değişikliği yapan yetkiliyi cezalandırır.
  client.on('guildMemberUpdate', async (oldMember, newMember) => {
    if (!newMember.guild || (config.guildId && newMember.guild.id !== config.guildId)) return;
    const guild = newMember.guild;

    // Sadece rol silinme durumlarını kontrol et
    const removedRoles = oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id));
    if (removedRoles.size === 0) return;

    // Denetim kaydı: Rolleri kimin sildiğini Audit Log'dan oku
    const entry = await getLatestAuditLog(guild, AuditLogEvent.MemberRoleUpdate, newMember.id, {
      delayMs: 800,
      maxAgeMs: 7000,
      retries: 1
    });

    if (!entry || !entry.executor) return;

    const executor = entry.executor;

    // Değişikliği yapan yetkili Whitelist'te ise izin ver
    if (await isWhitelisted(executor, guild)) return;

    // Kritik rol kontrolü: Silinen roller arasında Whitelist veya Yönetici rolleri var mı?
    const hasCriticalRole = removedRoles.some(r =>
      config.whitelistedRoles.includes(r.id) ||
      (r.permissions && r.permissions.has(PermissionFlagsBits.Administrator))
    );

    // Hız takibi: Değişikliği yapan executor son 10 saniyede kaç kez rol sildi?
    const now = Date.now();
    let timestamps = executorRoleStrippingMap.get(executor.id) || [];
    timestamps = timestamps.filter(t => now - t <= ROLE_STRIP_WINDOW_MS);
    timestamps.push(now);
    executorRoleStrippingMap.set(executor.id, timestamps);

    const isRapidAbuse = timestamps.length >= ROLE_STRIP_LIMIT;

    if (hasCriticalRole || isRapidAbuse) {
      console.warn(`[GÜVENLİK İHLALİ - BRUTE FORCE ROL GASPI] ${executor.tag} -> ${newMember.user.tag} üyesinin rollerini sildi!`);

      // 1. MAĞDURA ROLLERİNİ İADE ET (Victim receives roles back!)
      await safeExecute(
        () => newMember.roles.add(removedRoles, '[Piyader RP Güvenlik] Yetkisiz silinen roller geri iade edildi'),
        `Restore Roles to ${newMember.user.tag}`
      );

      // 2. SALDIRGANA (EXECUTOR) CEZA UYGULA! (Asla mağduru cezalandırma!)
      const reason = hasCriticalRole
        ? `Kritik Yetkili Rol Gaspı: ${newMember.user.tag} üyesinin yetkileri alındı`
        : `Aşırı Hızlı Profil Güncellemesi (API Abuse / Brute-Force Rol Gaspı)`;

      await punishUser(guild, executor, reason, {
        ban: true,
        eventType: 'MEMBER_ROLE_ABUSE'
      });

      // 3. DETAYLI GÜVENLİK BİLDİRİMİ GÖNDER
      await sendSecurityLog(guild, {
        title: '🚨 BRUTE-FORCE (API) / ROL GASPI SALDIRISI ENGELLENDİ!',
        description: `Bir kullanıcı başka bir üyenin rollerini yetkisiz ve hızlı şekilde silmeye çalıştı! Değişikliği yapan saldırgan yasaklandı, mağdurun rolleri iade edildi.`,
        severity: 'CRITICAL',
        executor: executor,
        fields: [
          { name: 'Saldırgan (Değişikliği Yapan)', value: `<@${executor.id}> (\`${executor.tag}\`)`, inline: true },
          { name: 'Mağdur (Rolleri Silinen)', value: `<@${newMember.id}> (\`${newMember.user.tag}\`)`, inline: true },
          { name: 'Tespit Yöntemi', value: '`Aşırı Hızlı Profil Güncellemesi (API Abuse)`', inline: false },
          { name: 'Gasp Edilen Roller', value: removedRoles.map(r => `\`@${r.name}\``).join(', ').slice(0, 900), inline: false },
          { name: 'Alınan Önlem', value: 'Saldırgan yasaklandı/yetkileri alındı, mağdurun tüm rolleri eksiksiz iade edildi.', inline: false }
        ]
      });
    }
  });
};

module.exports.executorRoleStrippingMap = executorRoleStrippingMap;
