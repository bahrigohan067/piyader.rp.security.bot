const { AuditLogEvent } = require('discord.js');
const { isWhitelisted } = require('../utils/whitelist');
const { getLatestAuditLog } = require('../utils/audit');
const { punishUser } = require('../utils/punisher');
const { restoreChannel } = require('../utils/backup');
const { sendSecurityLog } = require('../utils/logger');
const { safeExecute } = require('../utils/safeExecute');
const { logEvent } = require('../memory/memoryManager');
const config = require('../../config');

/**
 * Kanal Koruması Modülü
 * @param {import('discord.js').Client} client
 */
module.exports = function channelGuard(client) {
  // 1. KANAL SİLME KORUMASI
  client.on('channelDelete', async channel => {
    if (!channel.guild || (config.guildId && channel.guild.id !== config.guildId)) return;
    const guild = channel.guild;

    const entry = await getLatestAuditLog(guild, AuditLogEvent.ChannelDelete, channel.id);
    if (!entry || !entry.executor) return;

    const executor = entry.executor;
    if (isWhitelisted(executor, guild)) return;

    console.warn(`[GÜVENLİK İHLALİ] Yetkisiz kanal silindi: #${channel.name} by ${executor.tag}`);

    // Cezalandır & Hafızaya Yaz
    await punishUser(guild, executor, `Yetkisiz kanal silme eylemi: #${channel.name}`, {
      ban: true,
      eventType: 'CHANNEL_DELETE'
    });

    // Geri Yükle
    if (config.backup.restoreOnDelete) {
      await restoreChannel(guild, channel.id, channel);
    }

    await sendSecurityLog(guild, {
      title: '🚨 KANAL SİLME SALDIRISI ENGELLENDİ',
      description: `Yetkisiz bir kullanıcı kanal sildi! Olay hafızaya kaydedildi, saldırgan yasaklandı ve kanal kurtarıldı.`,
      severity: 'CRITICAL',
      executor: executor,
      fields: [
        { name: 'Silinen Kanal', value: `\`#${channel.name}\` (\`${channel.id}\`)`, inline: true },
        { name: 'Kanal Türü', value: `${channel.type}`, inline: true },
        { name: 'Alınan Önlem', value: 'Saldırgan yasaklandı, kanal otomatik yeniden oluşturuldu.', inline: false }
      ]
    });
  });

  // 2. KANAL OLUŞTURMA KORUMASI
  client.on('channelCreate', async channel => {
    if (!channel.guild || (config.guildId && channel.guild.id !== config.guildId)) return;
    const guild = channel.guild;

    const entry = await getLatestAuditLog(guild, AuditLogEvent.ChannelCreate, channel.id);
    if (!entry || !entry.executor) return;

    const executor = entry.executor;
    if (isWhitelisted(executor, guild)) return;

    console.warn(`[GÜVENLİK İHLALİ] Yetkisiz kanal açıldı: #${channel.name} by ${executor.tag}`);

    // İzinsiz açılan kanalı güvenle sil
    await safeExecute(() => channel.delete('[Piyader RP Güvenlik] Yetkisiz kanal açma engellendi'), 'Delete Unauthorized Channel');

    // Cezalandır & Hafızaya Yaz
    await punishUser(guild, executor, `Yetkisiz kanal açma eylemi: #${channel.name}`, {
      timeout: true,
      eventType: 'CHANNEL_CREATE'
    });

    await sendSecurityLog(guild, {
      title: '⚠️ İZİNSİZ KANAL OLUŞTURMA ENGELLENDİ',
      description: `Yetkisiz kullanıcı kanal oluşturmaya çalıştı. Oluşturulan kanal imha edildi.`,
      severity: 'DANGER',
      executor: executor,
      fields: [
        { name: 'Açılmaya Çalışılan Kanal', value: `\`#${channel.name}\``, inline: true },
        { name: 'Alınan Önlem', value: 'Kanal imha edildi ve kullanıcı kısıtlandı.', inline: false }
      ]
    });
  });

  // 3. KANAL GÜNCELLEME KORUMASI (İsim, konu, izin değiştirme)
  client.on('channelUpdate', async (oldChannel, newChannel) => {
    if (!newChannel.guild || (config.guildId && newChannel.guild.id !== config.guildId)) return;
    const guild = newChannel.guild;

    const entry = await getLatestAuditLog(guild, AuditLogEvent.ChannelUpdate, newChannel.id);
    if (!entry || !entry.executor) return;

    const executor = entry.executor;
    if (isWhitelisted(executor, guild)) return;

    // Kanaldaki değişiklikleri geri al
    await safeExecute(() => newChannel.edit({
      name: oldChannel.name,
      topic: oldChannel.topic,
      nsfw: oldChannel.nsfw,
      rateLimitPerUser: oldChannel.rateLimitPerUser,
      reason: '[Piyader RP Güvenlik] Yetkisiz kanal düzenlemesi geri alındı'
    }), 'Revert Channel Edits');

    await punishUser(guild, executor, `Yetkisiz kanal düzenleme eylemi: #${newChannel.name}`, {
      timeout: true,
      eventType: 'CHANNEL_UPDATE'
    });

    await sendSecurityLog(guild, {
      title: '⚠️ İZİNSİZ KANAL DÜZENLEMESİ ENGELLENDİ',
      description: `Yetkisiz kullanıcı kanal ayarlarını değiştirdi. Eski haline döndürüldü.`,
      severity: 'WARNING',
      executor: executor,
      fields: [
        { name: 'Kanal', value: `<#${newChannel.id}> (\`${newChannel.name}\`)`, inline: true },
        { name: 'Eski İsim', value: `\`${oldChannel.name}\``, inline: true },
        { name: 'Yeni İsim', value: `\`${newChannel.name}\``, inline: true }
      ]
    });
  });
};
