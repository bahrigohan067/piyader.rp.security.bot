const { AuditLogEvent } = require('discord.js');
const { isWhitelisted } = require('../utils/whitelist');
const { getLatestAuditLog } = require('../utils/audit');
const { punishUser } = require('../utils/punisher');
const { sendSecurityLog } = require('../utils/logger');
const { safeExecute } = require('../utils/safeExecute');
const config = require('../../config');

/**
 * Webhook Koruması Modülü (Webhook Guard)
 * Discord Audit Log gecikmesi (Race Condition) ve kanal hedef kontrolü ile
 * masum yetkililerin yanlışlıkla banlanması (False Positive) önlenmiştir.
 * 
 * @param {import('discord.js').Client} client
 */
module.exports = function webhookGuard(client) {
  client.on('webhookUpdate', async channel => {
    if (!channel.guild || (config.guildId && channel.guild.id !== config.guildId)) return;
    const guild = channel.guild;

    // 1. Audit Log sorgusu: 800ms gecikme ile logun yazılmasını bekle ve
    // SADECE bu kanalda (channel.id) oluşturulan webhook logunu eşleştir.
    const entry = await getLatestAuditLog(guild, AuditLogEvent.WebhookCreate, null, {
      delayMs: 800,
      maxAgeMs: 7000,
      retries: 1,
      customFilter: logEntry => {
        const logChannelId = logEntry.extra?.channel?.id || logEntry.target?.channelId;
        return logChannelId === channel.id;
      }
    });

    // Kesin olarak bu kanalda yeni bir webhook logu bulunamadıysa işlem yapma (False Positive engeli)
    if (!entry || !entry.executor) return;

    const executor = entry.executor;
    if (await isWhitelisted(executor, guild)) return;

    const createdWebhookId = entry.target ? entry.target.id : null;
    const webhookName = entry.target ? entry.target.name : 'Bilinmeyen Webhook';

    console.warn(`[GÜVENLİK İHLALİ] İzinsiz webhook oluşturuldu: #${channel.name} (${webhookName}) by ${executor.tag}`);

    // 2. SADECE saldırganın açtığı veya bu olayda oluşturulan izinsiz webhook'u güvenle sil
    await safeExecute(async () => {
      const webhooks = await channel.fetchWebhooks();
      for (const webhook of webhooks.values()) {
        const isTargetWebhook = createdWebhookId && webhook.id === createdWebhookId;
        const isOwnerExecutor = webhook.owner && webhook.owner.id === executor.id;

        if (isTargetWebhook || isOwnerExecutor) {
          await webhook.delete('[Piyader RP Güvenlik] Yetkisiz webhook silindi');
        }
      }
    }, 'Delete Unauthorized Webhooks');

    // 3. Webhook açan kullanıcıyı cezalandır & Hafızaya Yaz
    await punishUser(guild, executor, `Yetkisiz webhook oluşturma: #${channel.name} (${webhookName})`, {
      timeout: true,
      eventType: 'WEBHOOK_INJECTION'
    });

    await sendSecurityLog(guild, {
      title: '🚨 İZİNSİZ WEBHOOK SALDIRISI ENGELLENDİ',
      description: `Yetkisiz bir kullanıcı kanalda webhook oluşturdu! Webhook derhal silindi ve kullanıcı cezalandırıldı.`,
      severity: 'DANGER',
      executor: executor,
      fields: [
        { name: 'Kanal', value: `<#${channel.id}> (\`#${channel.name}\`)`, inline: true },
        { name: 'Oluşturulan Webhook', value: `\`${webhookName}\` (\`${createdWebhookId || 'ID Yok'}\`)`, inline: true },
        { name: 'Oluşturan Saldırgan', value: `<@${executor.id}> (\`${executor.tag}\`)`, inline: true },
        { name: 'Alınan Önlem', value: 'Webhook imha edildi ve kullanıcının yetkileri kısıtlandı.', inline: false }
      ]
    });
  });
};
