const { sendSecurityLog } = require('../utils/logger');
const config = require('../../config');

// Son giriş yapan üyeleri hafızada tutan dizi
const recentJoins = [];
let isLockdownActive = false;
let lockdownTimeout = null;

/**
 * Anti-Raid ve Kitle Saldırısı Koruması
 * @param {import('discord.js').Client} client
 */
module.exports = function raidGuard(client) {
  client.on('guildMemberAdd', async member => {
    if (!member.guild || (config.guildId && member.guild.id !== config.guildId)) return;
    if (member.user.bot) return; // Botları botGuard inceler

    const guild = member.guild;
    const now = Date.now();

    // 1. HESAP YAŞI DENETİMİ (Şüpheli / Sahte Hesap Kontrolü)
    const accountAgeMs = now - member.user.createdTimestamp;
    const accountAgeDays = Math.floor(accountAgeMs / (1000 * 60 * 60 * 24));

    if (accountAgeDays < config.limits.minimumAccountAgeDays) {
      console.warn(`[ŞÜPHELİ HESAP] Yeni açılmış hesap katıldı: ${member.user.tag} (Yaş: ${accountAgeDays} gün)`);

      if (config.quarantineRoleId) {
        await member.roles.add(config.quarantineRoleId, '[Piyader RP Güvenlik] Yeni hesap karantinası').catch(() => null);
      }

      await sendSecurityLog(guild, {
        title: '⚠️ ŞÜPHELİ YENİ HESAP TESPİT EDİLDİ',
        description: `Sunucuya çok yeni oluşturulmuş bir hesap katıldı. Şüpheli hesap olarak işaretlendi.`,
        severity: 'WARNING',
        executor: member.user,
        fields: [
          { name: 'Kullanıcı', value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
          { name: 'Hesap Yaşı', value: `\`${accountAgeDays} gün\` (Min: ${config.limits.minimumAccountAgeDays} gün)`, inline: true }
        ]
      });
    }

    // 2. MASS JOIN / TOKEN RAID HIZ KONTROLÜ
    recentJoins.push({ id: member.id, time: now });

    // Zaman penceresi dışındakileri temizle
    const validJoins = recentJoins.filter(j => now - j.time <= config.limits.raidTimeWindowMs);
    recentJoins.length = 0;
    recentJoins.push(...validJoins);

    // Eşik aşıldıysa Raid Alarmı & Karantina Modu
    if (validJoins.length >= config.limits.raidJoinThreshold) {
      if (!isLockdownActive) {
        isLockdownActive = true;
        console.error(`[🚨 RAID TESPİT EDİLDİ!] ${config.limits.raidTimeWindowMs / 1000} saniyede ${validJoins.length} hesap girişi!`);

        await sendSecurityLog(guild, {
          title: '🚨 AKIN / RAID SALDIRISI BAŞLADI (PANIC MODE DEVREDE)',
          description: `Sunucuya aynı anda çok sayıda hesap girişi tespit edildi! Otomatik savunma kalkanı devreye sokuldu.`,
          severity: 'CRITICAL',
          fields: [
            { name: 'Giriş Hızı', value: `\`${validJoins.length} kullanıcı / ${config.limits.raidTimeWindowMs / 1000} sn\``, inline: true },
            { name: 'Alınan Önlem', value: 'Gelen hesaplar otomatik atılıyor / karantinaya alınıyor.', inline: false }
          ]
        });

        // 60 saniye sonra lockdown'ı otomatik gevşet
        clearTimeout(lockdownTimeout);
        lockdownTimeout = setTimeout(() => {
          isLockdownActive = false;
          console.log('[RAID] Panic mode sona erdi.');
        }, 60000);
      }

      // Raid esnasında giren üyeyi sunucudan at (Kick)
      await member.kick('[Piyader RP Güvenlik] Raid koruması kapsamında otomatik atıldı').catch(() => null);
    }
  });
};
