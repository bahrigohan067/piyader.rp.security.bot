const { AuditLogEvent } = require('discord.js');
const { isWhitelisted } = require('../utils/whitelist');
const { getLatestAuditLog } = require('../utils/audit');
const { punishUser } = require('../utils/punisher');
const { sendSecurityLog } = require('../utils/logger');
const config = require('../../config');

/**
 * Emoji ve Sticker Koruması Modülü
 * @param {import('discord.js').Client} client
 */
module.exports = function emojiGuard(client) {
  // 1. EMOJI SİLME KORUMASI
  client.on('emojiDelete', async emoji => {
    if (!emoji.guild || (config.guildId && emoji.guild.id !== config.guildId)) return;
    const guild = emoji.guild;

    const entry = await getLatestAuditLog(guild, AuditLogEvent.EmojiDelete, emoji.id);
    if (!entry || !entry.executor) return;

    const executor = entry.executor;
    if (isWhitelisted(executor, guild)) return;

    console.warn(`[GÜVENLİK İHLALİ] Yetkisiz emoji silindi: :${emoji.name}: by ${executor.tag}`);

    // Cezalandır & Hafızaya Yaz
    await punishUser(guild, executor, `Yetkisiz emoji silme eylemi: :${emoji.name}:`, {
      timeout: true,
      eventType: 'EMOJI_DELETE'
    });

    await sendSecurityLog(guild, {
      title: '⚠️ EMOJİ SİLME EYLEMİ ENGELLENDİ',
      description: `Yetkisiz bir kullanıcı sunucu emojisini sildi! Kullanıcı cezalandırıldı.`,
      severity: 'WARNING',
      executor: executor,
      fields: [
        { name: 'Silinen Emoji', value: `\`:${emoji.name}:\` (\`${emoji.id}\`)`, inline: true }
      ]
    });
  });

  // 2. STICKER SİLME KORUMASI
  client.on('stickerDelete', async sticker => {
    if (!sticker.guild || (config.guildId && sticker.guild.id !== config.guildId)) return;
    const guild = sticker.guild;

    const entry = await getLatestAuditLog(guild, AuditLogEvent.StickerDelete, sticker.id);
    if (!entry || !entry.executor) return;

    const executor = entry.executor;
    if (isWhitelisted(executor, guild)) return;

    console.warn(`[GÜVENLİK İHLALİ] Yetkisiz sticker silindi: ${sticker.name} by ${executor.tag}`);

    // Cezalandır & Hafızaya Yaz
    await punishUser(guild, executor, `Yetkisiz çıkartma (sticker) silme eylemi: ${sticker.name}`, {
      timeout: true,
      eventType: 'STICKER_DELETE'
    });

    await sendSecurityLog(guild, {
      title: '⚠️ STICKER SİLME EYLEMİ ENGELLENDİ',
      description: `Yetkisiz bir kullanıcı sunucu çıkartmasını sildi! Kullanıcı cezalandırıldı.`,
      severity: 'WARNING',
      executor: executor,
      fields: [
        { name: 'Silinen Sticker', value: `\`${sticker.name}\` (\`${sticker.id}\`)`, inline: true }
      ]
    });
  });
};
