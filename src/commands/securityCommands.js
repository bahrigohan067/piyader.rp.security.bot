const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getSecurityStats, getOffender, getRecentEvents } = require('../memory/memoryManager');
const { isWhitelisted } = require('../utils/whitelist');
const config = require('../../config');

const commands = [
  new SlashCommandBuilder()
    .setName('guvenlik-durum')
    .setDescription('Piyader RP güvenlik kalkanı ve hafıza durumunu görüntüler.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('sabika-sorgula')
    .setDescription('Bir kullanıcının güvenlik hafızasındaki sabıka ve ihlal geçmişini sorgular.')
    .addUserOption(option =>
      option.setName('kullanici')
        .setDescription('Sorgulanacak kullanıcı')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('son-olaylar')
    .setDescription('Kalıcı hafızaya kaydedilen son 10 güvenlik olayını listeler.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
];

/**
 * Slash komutlarını hedef sunucuya kaydeder ve etkileşimleri dinler.
 * @param {import('discord.js').Client} client
 */
async function registerSecurityCommands(client) {
  client.on('ready', async () => {
    try {
      if (config.guildId) {
        const guild = client.guilds.cache.get(config.guildId);
        if (guild) {
          await guild.commands.set(commands);
          console.log(`[SLASH KOMUTLARI] ${commands.length} güvenlik komutu "${guild.name}" sunucusuna yüklendi.`);
        }
      }
    } catch (err) {
      console.error('[Slash Komut Kayıt Hatası]', err.message);
    }
  });

  client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    if (config.guildId && interaction.guildId !== config.guildId) return;

    // Yetki kontrolü (Yönetici veya Whitelist rolü)
    if (!(await isWhitelisted(interaction.member, interaction.guild)) && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: '❌ Bu güvenlik komutunu kullanmaya yetkiniz bulunmamaktadır.',
        ephemeral: true
      });
    }

    const { commandName } = interaction;

    // 1. /guvenlik-durum
    if (commandName === 'guvenlik-durum') {
      const stats = getSecurityStats();
      const mem = process.memoryUsage();
      const uptimeHours = (process.uptime() / 3600).toFixed(1);

      const embed = new EmbedBuilder()
        .setTitle('🛡️ Piyader RP Güvenlik & Hafıza Durumu')
        .setColor(0x2ECC71)
        .addFields(
          { name: '💾 Hafıza Motoru', value: `\`${stats.engine}\``, inline: true },
          { name: '🛑 Engellenen Saldırılar', value: `\`${stats.blockedAttacks}\``, inline: true },
          { name: '📋 Toplam Güvenlik Olayı', value: `\`${stats.totalEvents}\``, inline: true },
          { name: '👤 Kayıtlı Sabıkalı Sayısı', value: `\`${stats.totalOffenders}\``, inline: true },
          { name: '⏱️ Bot Çalışma Süresi', value: `\`${uptimeHours} saat\``, inline: true },
          { name: '🧠 RAM Kullanımı', value: `\`${Math.round(mem.heapUsed / 1024 / 1024)}MB / ${Math.round(mem.rss / 1024 / 1024)}MB\``, inline: true },
          { name: '👑 Muaf Rol Sayısı', value: `\`${config.whitelistedRoles.length} rol\``, inline: true },
          { name: '📁 Depolama Dizini (Volume)', value: `\`${config.dataDir}\``, inline: true }
        )
        .setFooter({ text: 'Piyader RP Zero-Crash Guard System' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // 2. /sabika-sorgula
    if (commandName === 'sabika-sorgula') {
      const targetUser = interaction.options.getUser('kullanici');
      const offender = getOffender(targetUser.id);

      if (!offender || offender.violation_count === 0) {
        return interaction.reply({
          content: `✅ <@${targetUser.id}> (\`${targetUser.tag}\`) kullanıcısının güvenlik hafızasında **hiçbir kural ihlali veya sabıka kaydı bulunamadı**.`,
          ephemeral: true
        });
      }

      const strike = offender.violation_count || offender.violationCount;
      const history = offender.history || [];
      const historyText = history.slice(-5).map((h, i) =>
        `**${i + 1}.** <t:${Math.floor(h.timestamp / 1000)}:R> - \`${h.reason}\` -> *${h.actionTaken}*`
      ).join('\n') || 'Detaylı geçmiş bulunamadı.';

      const embed = new EmbedBuilder()
        .setTitle(`📂 Sabıka Kütüğü | ${targetUser.tag}`)
        .setColor(strike >= 3 ? 0xE74C3C : 0xE67E22)
        .addFields(
          { name: 'Kullanıcı', value: `<@${targetUser.id}> (\`${targetUser.id}\`)`, inline: true },
          { name: 'Toplam İhlal (Strike)', value: `\`${strike}\``, inline: true },
          { name: 'Son İhlal Nedeni', value: `\`${offender.last_reason || offender.lastReason || 'Bilinmiyor'}\``, inline: false },
          { name: 'Son İhlal Geçmişi', value: historyText, inline: false }
        )
        .setThumbnail(targetUser.displayAvatarURL())
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // 3. /son-olaylar
    if (commandName === 'son-olaylar') {
      const events = getRecentEvents(10);

      if (events.length === 0) {
        return interaction.reply({ content: 'ℹ️ Henüz kaydedilmiş bir güvenlik olayı bulunmamaktadır.', ephemeral: true });
      }

      const list = events.map(e => {
        const time = `<t:${Math.floor(e.timestamp / 1000)}:R>`;
        const user = e.executor_tag ? `\`${e.executor_tag}\`` : 'Bilinmeyen';
        return `• ${time} **[${e.severity}]** \`${e.event_type}\` - Yapan: ${user}\n└ *${e.details}* -> **${e.action_taken || 'Müdahale Edildi'}**`;
      }).join('\n\n');

      const embed = new EmbedBuilder()
        .setTitle('📜 Son 10 Güvenlik Olayı (Hafıza Günlüğü)')
        .setDescription(list.slice(0, 4000))
        .setColor(0x3498DB)
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }
  });
}

module.exports = {
  registerSecurityCommands
};
