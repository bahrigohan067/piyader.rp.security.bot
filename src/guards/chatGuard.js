const { isWhitelisted } = require('../utils/whitelist');
const { sendSecurityLog } = require('../utils/logger');
const { safeExecute } = require('../utils/safeExecute');
const { logEvent } = require('../memory/memoryManager');
const { punishUser } = require('../utils/punisher');
const config = require('../../config');

// Kullanıcı mesaj geçmişi (Spam tespiti için)
const userMessageMap = new Map();

const INVITE_REGEX = /(discord\.(gg|io|me|li)|discordapp\.com\/invite|discord\.com\/invite)\/[a-zA-Z0-9]+/i;
const PHISHING_REGEX = /(free.*nitro|nitro.*free|steamcommunity-.*\.gift|discord-.*\.gift|discorcd.*\.com)/i;

/**
 * Sohbet, Spam, Reklam ve Etiket Koruması
 * @param {import('discord.js').Client} client
 */
function chatGuard(client) {
  client.on('messageCreate', async message => {
    if (!message.guild || message.author.bot) return;
    if (config.guildId && message.guild.id !== config.guildId) return;

    const guild = message.guild;
    const author = message.author;
    const member = message.member;

    // Whitelist kontrolü
    if (isWhitelisted(member || author, guild)) return;

    const now = Date.now();
    const content = message.content || '';

    // 1. REKLAM VE ZARARLI LİNK KORUMASI (Anti-Invite & Anti-Phishing)
    if (INVITE_REGEX.test(content) || PHISHING_REGEX.test(content)) {
      await safeExecute(() => message.delete(), 'Delete Scam/Invite Message');

      await punishUser(
        guild,
        author,
        'Yetkisiz reklam veya zararlı bağlantı paylaşımı',
        { timeout: true, eventType: 'PHISHING_OR_INVITE' }
      );
      return;
    }

    // 2. KİTLESEL ETİKET KORUMASI (Mass Mention / Mention Raid)
    const mentionCount = (message.mentions.users ? message.mentions.users.size : 0) +
                         (message.mentions.roles ? message.mentions.roles.size : 0);
    const hasEveryone = content.includes('@everyone') || content.includes('@here');

    if (mentionCount >= config.limits.maxMentionsPerMessage || hasEveryone) {
      await safeExecute(() => message.delete(), 'Delete Mass Mention Message');

      await punishUser(
        guild,
        author,
        `Toplu etiket baskını (${mentionCount} etiket veya @everyone)`,
        { timeout: true, eventType: 'MASS_MENTION' }
      );
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
      await safeExecute(() => message.delete(), 'Delete Spam Message');

      await punishUser(
        guild,
        author,
        `Aşırı hızlı mesaj gönderimi (Spam/Flood: ${recentMessages.length} msgs)`,
        { timeout: true, eventType: 'SPAM_FLOOD' }
      );
    }
  });
}

chatGuard.userMessageMap = userMessageMap;

module.exports = chatGuard;
