const { EmbedBuilder } = require('discord.js');
const config = require('../../config');

const COLORS = {
  INFO: 0x3498DB,     // Mavi
  WARNING: 0xF1C40F,  // Sarı
  DANGER: 0xE67E22,   // Turuncu
  CRITICAL: 0xE74C3C  // Kırmızı
};

/**
 * Güvenlik log kanalına zenginleştirilmiş embed bildirimi gönderir.
 * @param {import('discord.js').Guild} guild
 * @param {object} options
 * @param {string} options.title
 * @param {string} options.description
 * @param {'INFO'|'WARNING'|'DANGER'|'CRITICAL'} [options.severity='WARNING']
 * @param {Array<{name: string, value: string, inline?: boolean}>} [options.fields=[]]
 * @param {import('discord.js').User|null} [options.executor=null]
 */
async function sendSecurityLog(guild, options) {
  const {
    title,
    description,
    severity = 'WARNING',
    fields = [],
    executor = null
  } = options;

  console.log(`[GÜVENLİK ALARMI - ${severity}] ${title}: ${description}`);

  if (!config.logChannelId) return;

  try {
    const channel = guild.channels.cache.get(config.logChannelId) ||
                    await guild.channels.fetch(config.logChannelId).catch(() => null);

    if (!channel || !channel.isTextBased()) return;

    const embed = new EmbedBuilder()
      .setTitle(`🛡️ PİYADER RP GÜVENLİK | ${title}`)
      .setDescription(description)
      .setColor(COLORS[severity] || COLORS.WARNING)
      .setTimestamp(new Date())
      .setFooter({
        text: `Piyader RP Guard System • Guild ID: ${guild.id}`,
        iconURL: guild.iconURL({ dynamic: true }) || undefined
      });

    if (executor) {
      embed.setAuthor({
        name: `${executor.tag} (${executor.id})`,
        iconURL: executor.displayAvatarURL({ dynamic: true })
      });
    }

    if (fields.length > 0) {
      embed.addFields(fields);
    }

    await channel.send({ embeds: [embed] }).catch(err => {
      console.error('[Log Kanalı Gönderim Hatası]', err.message);
    });
  } catch (error) {
    console.error('[sendSecurityLog Hatası]', error.message);
  }
}

module.exports = {
  sendSecurityLog,
  COLORS
};
