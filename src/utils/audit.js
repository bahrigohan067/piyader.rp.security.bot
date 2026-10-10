const { AuditLogEvent } = require('discord.js');

/**
 * Belirtilen Audit Log türü için son eylemi güvenli şekilde çeker.
 * Discord API gecikmesi (propagation delay) ve Race Condition kaynaklı
 * False-Positive (masum yetkililerin yanlışlıkla banlanması) zafiyetini önlemek için:
 * 1. API'ye logun yazılması için 800ms bekler.
 * 2. limit: 6 ile son logları tarar (tek loga bağımlı kalmaz).
 * 3. Hedef ID (targetId) ve özel filtreleri (customFilter) kesin olarak doğrular.
 * 4. Bulunamazsa kısa bir gecikmeyle yeniden dener.
 *
 * @param {import('discord.js').Guild} guild
 * @param {number} actionType AuditLogEvent
 * @param {string|null} targetId Opsiyonel hedef ID doğrulaması
 * @param {object|number} [optionsOrMaxAge={}] Yapılandırma veya maksimum log yaşı
 * @param {number} [optionsOrMaxAge.delayMs=800] Logun Discord API'sine yansıması için bekleme süresi (ms)
 * @param {number} [optionsOrMaxAge.maxAgeMs=8000] Maksimum log yaşı (ms) - Varsayılan 8 saniye
 * @param {number} [optionsOrMaxAge.retries=1] Bulunamadığında yeniden deneme sayısı
 * @param {(entry: import('discord.js').GuildAuditLogsEntry) => boolean} [optionsOrMaxAge.customFilter] Özel filtre (örn: kanal eşleşmesi)
 * @returns {Promise<import('discord.js').GuildAuditLogsEntry|null>}
 */
async function getLatestAuditLog(guild, actionType, targetId = null, optionsOrMaxAge = {}) {
  let options = {};
  if (typeof optionsOrMaxAge === 'number') {
    options = { maxAgeMs: optionsOrMaxAge };
  } else if (optionsOrMaxAge && typeof optionsOrMaxAge === 'object') {
    options = optionsOrMaxAge;
  }

  const {
    delayMs = 800,
    maxAgeMs = 8000,
    retries = 1,
    customFilter = null
  } = options;

  let attempts = 0;
  const maxAttempts = retries + 1;

  while (attempts < maxAttempts) {
    attempts++;

    // Discord API gecikmesini (200ms - 1500ms) tolere etmek için ilk çağrıda bekle
    if (delayMs > 0 && attempts === 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    } else if (attempts > 1) {
      // Yeniden denemeler arası kısa bekleme
      await new Promise(resolve => setTimeout(resolve, 600));
    }

    try {
      const fetchedLogs = await guild.fetchAuditLogs({
        limit: 6,
        type: actionType
      });

      const now = Date.now();

      // Son loglar arasından hedefe ve zaman eşiğine uyan kaydı bul
      const matchedEntry = fetchedLogs.entries.find(entry => {
        // 1. Log yaşı kontrolü (çok eski bir log olmamalı)
        const logAge = now - entry.createdTimestamp;
        if (logAge > maxAgeMs) return false;

        // 2. Hedef ID doğrulaması
        if (targetId) {
          const entryTargetId = entry.target ? entry.target.id : null;
          if (entryTargetId !== targetId) return false;
        }

        // 3. Özel filtre doğrulaması (örneğin webhook kanal ID eşleşmesi)
        if (customFilter && typeof customFilter === 'function') {
          if (!customFilter(entry)) return false;
        }

        return true;
      });

      if (matchedEntry) {
        return matchedEntry;
      }
    } catch (error) {
      console.error(`[Audit Log Sorgu Hatası] Tür: ${actionType} (Deneme: ${attempts})`, error.message);
    }
  }

  // Eşleşen kesin bir log bulunamadıysa asla rastgele/eski bir log dönme
  return null;
}

module.exports = {
  getLatestAuditLog
};
