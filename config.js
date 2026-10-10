require('dotenv').config();
const path = require('path');

module.exports = {
  // Sunucu ID (GİLD_İD / GUILD_ID)
  guildId: process.env.GUILD_ID || process.env.GİLD_İD || '',

  // Bot Token
  token: process.env.BOT_TOKEN || '',

  // Sunucu Sahibi / Ana Yönetici ID (İsteğe bağlı ek güvenli kullanıcılar)
  ownerId: process.env.OWNER_ID || '',

  // Güvenlik Bildirim Log Kanalı ID
  logChannelId: process.env.SECURITY_LOG_CHANNEL_ID || '',

  // Karantina Rolü ID (İhlal yapanların atanacağı rol - opsiyonel)
  quarantineRoleId: process.env.QUARANTINE_ROLE_ID || '',

  // RAILWAY & KALICI DEPOLAMA (VOLUME) DİZİNİ
  // Railway Persistent Volume kullanıldığında '/app/data' olarak bağlanır.
  dataDir: process.env.DATA_DIR || path.join(__dirname, 'data'),

  // MUAF TUTULACAK (WHITELIST) ROLLER
  whitelistedRoles: [
    '1545525713032184039', // @| 𖣂
    '1529546007635824680', // @|👤KURUCU
    '1542271077206458489', // @W
    '1544590583106895913', // @Sunucu Botu
    '1542262938478575636', // @BOTS
    '1544152662784876627', // @🤖ER-LC PİYADELERİ
    '1547579436361060465', // @| 🤖 ER-LC PİYADELERİ | [yan çar]
    '1539167256246747186'  // @|👤Üst Yönetim
  ],

  // Güvenli Kullanıcı ID'leri (Varsa ek kullanıcılar)
  whitelistedUsers: (process.env.WHITELIST_USERS || '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean),

  // Güvenli Bot ID'leri (Piyade RP Ekosistemindeki Botlar: piyade.rp.bot, müzik, yapay zeka vb.)
  whitelistedBots: [
    ...(process.env.WHITELIST_BOTS || '').split(',').map(id => id.trim()).filter(Boolean),
    process.env.PIYADE_BOT_ID || '',
    process.env.AI_BOT_ID || '',
    process.env.MUSIC_BOT_ID || '',
    process.env.BOT_1_ID || '',
    process.env.REHBER_BOT_ID || ''
  ].filter(Boolean),

  // GÜVENLİK VE LİMİT AYARLARI (LIMITS & THRESHOLDS)
  limits: {
    // Kanal Koruması
    channelDeleteLimit: 1,
    channelCreateLimit: 2,

    // Rol Koruması
    roleDeleteLimit: 1,
    roleCreateLimit: 2,

    // Ban & Kick Koruması
    banLimit: 1,
    kickLimit: 1,

    // Anti-Raid / Akın Koruması
    raidJoinThreshold: 5,     // 5 saniye içinde kaç üye girerse raid sayılır
    raidTimeWindowMs: 5000,   // 5 saniye
    minimumAccountAgeDays: 3, // 3 günden yeni hesaplar için şüpheli alarmı

    // Sohbet Koruması
    spamMessageLimit: 5,      // 4 saniyede 5 mesaj atarsa sustur
    spamTimeWindowMs: 4000,
    maxMentionsPerMessage: 3, // Bir mesajda maksimum izin verilen etiket sayısı
    timeoutDurationMinutes: 10 // Ceza susturma süresi (dakika)
  },

  // KADEMELİ CEZA SİSTEMİ (ESCALATING PENALTIES)
  escalatingPenalties: {
    enabled: true,
    strike1: 'timeout',    // 1. İhlal: Timeout (Susturma)
    strike2: 'quarantine', // 2. İhlal: Rollerin alınması ve Karantinaya atma
    strike3: 'ban'         // 3. İhlal: Sunucudan kalıcı Yasaklama (Ban)
  },

  // OTOMATİK YEDEKLEME VE HAFIZA AYARLARI
  backup: {
    autoBackupIntervalMinutes: 30, // 30 dakikada bir otomatik kanal/rol yedeği
    restoreOnDelete: true          // Silinen kanal veya rolü anında yeniden oluştur
  },

  // HATA DAYANIKLILIĞI VE ÇÖKMEYİ ÖNLEME (ZERO-CRASH FAULT TOLERANCE)
  resilience: {
    maxRetries: 3,
    retryDelayMs: 1000,
    suppressExpectedDiscordErrors: true // 50013, 10008 gibi beklenen API hatalarını yut ve logla
  }
};
