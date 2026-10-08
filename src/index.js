require('dotenv').config();
const { Client, GatewayIntentBits, Partials, ActivityType } = require('discord.js');
const config = require('../config');

// Güvenlik Modülleri
const channelGuard = require('./guards/channelGuard');
const roleGuard = require('./guards/roleGuard');
const memberGuard = require('./guards/memberGuard');
const botGuard = require('./guards/botGuard');
const webhookGuard = require('./guards/webhookGuard');
const guildGuard = require('./guards/guildGuard');
const emojiGuard = require('./guards/emojiGuard');
const raidGuard = require('./guards/raidGuard');
const chatGuard = require('./guards/chatGuard');

// Yardımcı Araçlar
const { takeFullBackup } = require('./utils/backup');

// Discord İstemcisi Yapılandırması
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildBans,
    GatewayIntentBits.GuildEmojisAndStickers,
    GatewayIntentBits.GuildWebhooks,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [
    Partials.User,
    Partials.Channel,
    Partials.GuildMember,
    Partials.Message
  ]
});

// Bot Hazır Olduğunda
client.once('ready', async () => {
  console.log('====================================================');
  console.log(`🛡️  PİYADER RP GÜVENLİK SİSTEMİ BAŞLATILDI`);
  console.log(`🤖  Bot Kullanıcı: ${client.user.tag} (${client.user.id})`);
  console.log(`🎯  Hedef Sunucu ID (GİLD_İD): ${config.guildId || 'Tüm Sunucular'}`);
  console.log(`👑  Korumalardan Muaf Rol Sayısı: ${config.whitelistedRoles.length}`);
  console.log('====================================================');

  client.user.setPresence({
    activities: [{ name: '🛡️ Piyader RP Güvenlik Kalkanı', type: ActivityType.Watching }],
    status: 'dnd'
  });

  // Hedef sunucuyu bul ve ilk tam yedeği al
  if (config.guildId) {
    const targetGuild = client.guilds.cache.get(config.guildId);
    if (targetGuild) {
      console.log(`[Sunucu Doğrulandı] "${targetGuild.name}" için ilk anlık görüntü (snapshot) alınıyor...`);
      await takeFullBackup(targetGuild);

      // Belirlenen aralıklarla otomatik periyodik yedekleme
      const intervalMs = (config.backup.autoBackupIntervalMinutes || 30) * 60 * 1000;
      setInterval(() => {
        takeFullBackup(targetGuild);
      }, intervalMs);
    } else {
      console.warn(`[UYARI] Bot, "${config.guildId}" ID'li sunucuda bulunamadı! Lütfen botu sunucuya davet edin.`);
    }
  }
});

// Koruma Modüllerini Başlat
channelGuard(client);
roleGuard(client);
memberGuard(client);
botGuard(client);
webhookGuard(client);
guildGuard(client);
emojiGuard(client);
raidGuard(client);
chatGuard(client);

// Hata Yakalama (Botun çökmesini önleme)
process.on('unhandledRejection', error => {
  console.error('[Yakalanamayan Promise Hatası]', error);
});

process.on('uncaughtException', error => {
  console.error('[Yakalanamayan İstisna]', error);
});

// Botu Başlat
if (!config.token) {
  console.error('❌ HATA: BOT_TOKEN tanımlanmamış! Lütfen .env dosyanızı kontrol ediniz.');
} else {
  client.login(config.token).catch(err => {
    console.error('❌ Bot Giriş Hatası:', err.message);
  });
}
