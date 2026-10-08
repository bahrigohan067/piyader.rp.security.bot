require('dotenv').config();
const { Client, GatewayIntentBits, Partials, ActivityType } = require('discord.js');
const config = require('../config');

// Kalıcı Hafıza Motoru
const { initDatabase } = require('./memory/db');
const { startCacheSweeper } = require('./utils/cacheSweeper');
const { registerSecurityCommands } = require('./commands/securityCommands');

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

// 1. Kalıcı Hafıza Veritabanını Başlat (SQLite WAL / Railway Persistent Volume)
initDatabase();

// 2. Discord İstemcisi Yapılandırması
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
  console.log(`🛡️  PİYADER RP ZERO-CRASH GÜVENLİK SİSTEMİ AKTİF`);
  console.log(`🤖  Bot: ${client.user.tag} (${client.user.id})`);
  console.log(`🎯  Hedef Sunucu ID: ${config.guildId || 'Tüm Sunucular'}`);
  console.log(`📁  Kalıcı Depolama (Volume): ${config.dataDir}`);
  console.log(`👑  Muaf Rol Sayısı: ${config.whitelistedRoles.length}`);
  console.log('====================================================');

  client.user.setPresence({
    activities: [{ name: '🛡️ Piyader RP Güvenlik Kalkanı', type: ActivityType.Watching }],
    status: 'dnd'
  });

  // Hedef sunucuyu doğrula ve ilk anlık görüntüyü al
  if (config.guildId) {
    const targetGuild = client.guilds.cache.get(config.guildId);
    if (targetGuild) {
      console.log(`[Sunucu Doğrulandı] "${targetGuild.name}" için ilk anlık görüntü hafızaya yazılıyor...`);
      await takeFullBackup(targetGuild);

      // Otomatik periyodik yedekleme
      const intervalMs = (config.backup.autoBackupIntervalMinutes || 30) * 60 * 1000;
      setInterval(() => {
        takeFullBackup(targetGuild);
      }, intervalMs);
    } else {
      console.warn(`[UYARI] Bot "${config.guildId}" ID'li sunucuda bulunamadı! Lütfen botu sunucuya ekleyin.`);
    }
  }

  // Bellek Sızıntısı Temizleyicisini Başlat
  startCacheSweeper([chatGuard.userMessageMap]);
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

// Slash Komutlarını Kaydet
registerSecurityCommands(client);

// Sıfır Çökme (Zero-Crash) ve Hata Yakalama Kalkanı
process.on('unhandledRejection', error => {
  console.error('[GÜVENLİ YAKALAMA - Unhandled Rejection]', error ? (error.stack || error.message || error) : 'Bilinmeyen Hata');
});

process.on('uncaughtException', error => {
  console.error('[GÜVENLİ YAKALAMA - Uncaught Exception]', error ? (error.stack || error.message || error) : 'Bilinmeyen İstisna');
});

process.on('SIGTERM', () => {
  console.log('[SIGTERM Alındı] Güvenli kapatma gerçekleştiriliyor...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[SIGINT Alındı] Güvenli kapatma gerçekleştiriliyor...');
  process.exit(0);
});

// Bot Girişi
if (!config.token) {
  console.error('❌ HATA: BOT_TOKEN tanımlanmamış! Lütfen .env dosyanızı veya Railway Variables ayarlarınızı kontrol ediniz.');
} else {
  client.login(config.token).catch(err => {
    console.error('❌ Bot Giriş Hatası:', err.message);
  });
}
