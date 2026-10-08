const { isWhitelisted } = require('../utils/whitelist');
const { sendSecurityLog } = require('../utils/logger');
const config = require('../../config');

// Kullanıcı mesaj geçmişi (Spam tespiti için)
const userMessageMap = new Map();

const INVITE_REGEX = /(discord\.(gg|io|me|li)|discordapp\.com\/invite|discord\.com\/invite)\/[a-zA-Z0-9]+/i;
const PHISHING_REGEX = /(free.*nitro|nitro.*free|steamcommunity-.*\.gift|discord-.*\.gift|discorcd.*\.com)/i;

/**
 * Sohbet, Spam, Reklam ve Etiket Koruması
 * @param {import('discord.js').Client} client
 */
module.exports = function chatGuard(client) {
  client.on('messageCreate', async message => {
    if (!message.guild || message.author.bot) return;
    if (config.guildId && message.guild.id !== config.guildId) return;

    const guild = message.guild;
    const author = message.author;
    const member = message.member;

    // Whitelist kontrolü
    if (isWhitelisted(member || author, guild)) return;

    const now = Date.now();
    const content = message.content;

    // 1. REKLAM VE ZARARLI LİNK KORUMASI (Anti-Invite & Anti-Phishing)
    if (INVITE_REGEX.test(content) || PHISHING_REGEX.test(content)) {
      await message.delete().catch(() => null);

      if (member) {
        await member.timeout(
          config.limits.timeoutDurationMinutes * 60 * 1000,
          '[Piyader RP Güvenlik] Reklam / Zararlı Link Paylaşımı'
        ).catch(() => null);
      }

      await sendSecurityLog(guild, {
        title: '🛑 REKLAM / OLTALAMA LİNKİ ENGELLENDİ',
        description: `Bir kullanıcı sohbette izinsiz Discord daveti veya şüpheli link paylaştı. Mesaj silindi ve kullanıcı susturuldu.`,
        severity: 'DANGER',
        executor: author,
        fields: [
          { name: 'Kanal', value: `<#${message.channel.id}>`, inline: true },
          { name: 'Kullanıcı', value: `<@${author.id}> (\`${author.tag}\`)`, inline: true },
          { name: 'Ceza Süresi', value: `${config.limits.timeoutDurationMinutes} Dakika Timeout`, inline: true }
        ]
      });
      return;
    }

    // 2. KİTLESEL ETİKET KORUMASI (Mass Mention / Mention Raid)
    const mentionCount = message.mentions.users.size + message.mentions.roles.size;
    const hasEveryone = message.content.includes('@everyone') || message.content.includes('@here');

    if (mentionCount >= config.limits.maxMentionsPerMessage || hasEveryone) {
      await message.delete().catch(() => null);

      if (member) {
        await member.timeout(
          config.limits.timeoutDurationMinutes * 60 * 1000,
          '[Piyader RP Güvenlik] Toplu Etiket Baskını'
        ).catch(() => null);
      }

      await sendSecurityLog(guild, {
        title: '⚠️ TOPLU ETİKET BASKINI ENGELLENDİ',
        description: `Bir kullanıcı limitin üzerinde etiket kullandı veya @everyone atmaya çalıştı.`,
        severity: 'WARNING',
        executor: author,
        fields: [
          { name: 'Kanal', value: `<#${message.channel.id}>`, inline: true },
          { name: 'Kullanıcı', value: `<@${author.id}> (\`${author.tag}\`)`, inline: true },
          { name: 'Etiket Sayısı', value: `${mentionCount}`, inline: true }
        ]
      });
      return;
    }

    // 3. SPAM & FLOOD KORUMASI
    let userData = userMessageMap.get(author.id);
    if (!userData) {
      userData = [];
      userMessageMap.set(author.id, userData);
    }

    userData.push(now);

    // Süresi geçmiş mesajları temizle
    const recentMessages = userData.filter(time => now - time <= config.limits.spamTimeWindowMs);
    userMessageMap.set(author.id, recentMessages);

    if (recentMessages.length >= config.limits.spamMessageLimit) {
      userMessageMap.delete(author.id);
      await message.delete().catch(() => null);

      if (member) {
        await member.timeout(
          5 * 60 * 1000,
          '[Piyader RP Güvenlik] Hızlı Mesaj Tekrarı / Flood'
        ).catch(() => null);
      }

      await sendSecurityLog(guild, {
        title: '⚠️ SPAM / FLOOD SALDIRISI ENGELLENDİ',
        description: `Kullanıcı kısa süre içinde aşırı sayıda mesaj gönderdiği için geçici olarak susturuldu.`,
        severity: 'WARNING',
        executor: author,
        fields: [
          { name: 'Kullanıcı', value: `<@${author.id}> (\`${author.tag}\`)`, inline: true },
          { name: 'Kanal', value: `<#${message.channel.id}>`, inline: true }
        ]
      });
    }
  });
};
