const { AuditLogEvent } = require('discord.js');
const { isWhitelisted } = require('../utils/whitelist');
const { getLatestAuditLog } = require('../utils/audit');
const { punishUser } = require('../utils/punisher');
const { sendSecurityLog } = require('../utils/logger');
const config = require('../../config');

/**
 * Webhook Koruması Modülü (Webhook Guard)
 * @param {import('discord.js').Client} client
 */
module.exports = function webhookGuard(client) {
  client.on('webhookUpdate', async channel => {
    if (!channel.guild || (config.guildId && channel.guild.id !== config.guildId)) return;
    const guild = channel.guild;

    const entry = await getLatestAuditLog(guild, AuditLogEvent.WebhookCreate);
    if (!entry || !entry.executor) return;

    const executor = entry.executor;
    if (isWhitelisted(executor, guild)) return;

    console.warn(`[GÜVENLİK İHLALİ] İzinsiz webhook oluşturuldu: #${channel.name} by ${executor.tag}`);

    // Kanaldaki webhook'ları bul ve izinsiz olanları sil
    try {
      const webhooks = await channel.fetchWebhooks();
      for (const webhook of webhooks.values()) {
        if (webhook.owner && webhook.owner.id === executor.id) {
          await webhook.delete('[Piyader RP Güvenlik] Yetkisiz webhook silindi');
        }
      }
    } catch (err) {
      console.error('[Webhook Silme Hatası]', err.message);
    }

    // Webhook açan kullanıcıyı cezalandır
    await punishUser(guild, executor, `Yetkisiz webhook oluşturma: #${channel.name}`, { timeout: true });

    await sendSecurityLog(guild, {
      title: '🚨 İZİNSİZ WEBHOOK SALDIRISI ENGELLENDİ',
      description: `Yetkisiz bir kullanıcı kanalda webhook oluşturdu! Webhook derhal silindi ve kullanıcı cezalandırıldı.`,
      severity: 'DANGER',
      executor: executor,
      fields: [
        { name: 'Kanal', value: `<#${channel.id}> (\`#${channel.name}\`)`, inline: true },
        { name: 'Oluşturan', value: `<@${executor.id}> (\`${executor.tag}\`)`, inline: true },
        { name: 'Alınan Önlem', value: 'Webhook imha edildi ve kullanıcının yetkileri kısıtlandı.', inline: false }
      ]
    });
  });
};
