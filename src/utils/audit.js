const { AuditLogEvent } = require('discord.js');

/**
 * Belirtilen Audit Log türü için son eylemi ve eylemi yapan kullanıcıyı güvenli şekilde çeker.
 * @param {import('discord.js').Guild} guild
 * @param {number} actionType AuditLogEvent
 * @param {string|null} targetId Opsiyonel hedef ID doğrulaması
 * @param {number} maxAgeMs Maksimum log yaşı (Varsayılan 12 saniye)
 * @returns {Promise<import('discord.js').GuildAuditLogsEntry|null>}
 */
async function getLatestAuditLog(guild, actionType, targetId = null, maxAgeMs = 15000) {
  try {
    const fetchedLogs = await guild.fetchAuditLogs({
      limit: 1,
      type: actionType
    });

    const entry = fetchedLogs.entries.first();
    if (!entry) return null;

    // Logun zamanını kontrol et (çok eski bir log olmamalı)
    const logAge = Date.now() - entry.createdTimestamp;
    if (logAge > maxAgeMs) {
      return null;
    }

    // Eğer hedef ID verilmişse hedefin eşleştiğini doğrula
    if (targetId && entry.target && entry.target.id !== targetId) {
      return null;
    }

    return entry;
  } catch (error) {
    console.error(`[Audit Log Hatası] Tür: ${actionType}`, error.message);
    return null;
  }
}

module.exports = {
  getLatestAuditLog
};
