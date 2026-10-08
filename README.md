# 🛡️ Piyader RP - Yüksek Seviye Güvenlik & Guard Botu

Piyader RP sunucusu için özel olarak geliştirilmiş; yetkili hesap çalınmaları, nuke saldırıları, izinsiz bot/webhook girişleri, token orduları (raid) ve flood/spam tehditlerine karşı 7/24 aktif tam koruma sağlayan profesyonel güvenlik botu.

---

## 📋 Muaf Tutulan (Whitelist) Roller

Aşağıdaki roller bütün koruma ve limit kurallarından otomatik olarak muaf tutulmuştur:

| Sıra | Rol Adı | Rol ID |
| :---: | :--- | :--- |
| **1** | `@\| 𖣂` | `1545525713032184039` |
| **2** | `@\|👤KURUCU` | `1529546007635824680` |
| **3** | `@W` | `1542271077206458489` |
| **4** | `@Sunucu Botu` | `1544590583106895913` |
| **5** | `@BOTS` | `1542262938478575636` |
| **6** | `@🤖ER-LC PİYADELERİ` | `1544152662784876627` |
| **7** | `@\| 🤖 ER-LC PİYADELERİ \| [yan çar]` | `1547579436361060465` |
| **10** | `@\|👤Üst Yönetim` | `1539167256246747186` |

*Not: Sunucu sahibi (`guild.ownerId`), botun kendisi ve `.env` dosyasındaki `OWNER_ID` her zaman tam yetkilidir.*

---

## ⚡ Aktif Koruma Modülleri

1. **Kanal Koruması (`channelGuard`)**:
   * Yetkisiz kanal silindiğinde saldırgan yasaklanır ve kanal anında tüm izinleri/kategorisiyle geri açılır.
   * Yetkisiz kanal oluşturulduğunda kanal anında silinir ve kullanıcı cezalandırılır.
   * Yetkisiz kanal isim ve izin değişiklikleri otomatik eski haline döndürülür.

2. **Rol Koruması (`roleGuard`)**:
   * Yetkisiz rol silindiğinde saldırgan yasaklanır ve rol eski rengi, izinleri ve sırasıyla otomatik geri yüklenir.
   * Yetkisiz rol oluşturulduğunda rol derhal imha edilir.
   * Bir role yetkisiz şekilde Yönetici (`Administrator`), Rolleri Yönet, Kanalları Yönet vb. tehlikeli izinler verildiğinde izin anında geri alınır ve yetkiyi veren cezalandırılır.

3. **Üye Ban & Kick Koruması (`memberGuard`)**:
   * Yetkisiz şekilde sunucudan üye banlayanlar anında yasaklanır ve banlanan masum üyenin yasağı geri kaldırılır.
   * Yetkisiz kick atanların yetkileri alınır ve sunucudan uzaklaştırılır.

4. **Anti-Bot Koruması (`botGuard`)**:
   * Sunucuya izinsiz bir bot sokulduğunda, eklenen bot anında yasaklanır (Ban).
   * Botu sunucuya sokan yetkilinin tüm rolleri alınır ve sunucudan uzaklaştırılır.

5. **Webhook Koruması (`webhookGuard`)**:
   * Kanallarda izinsiz webhook oluşturulduğunda webhook derhal imha edilir ve oluşturan cezalandırılır.

6. **Sunucu Ayarları & Vanity URL Koruması (`guildGuard`)**:
   * Sunucu adı, ikonu veya afişi izinsiz değiştirildiğinde eski haline döndürülür ve yapan kişi yasaklanır.

7. **Emoji & Sticker Koruması (`emojiGuard`)**:
   * Sunucuya ait özel RP emojileri veya çıkartmaları silinirse silen kişi cezalandırılır.

8. **Anti-Raid / Akın Koruması (`raidGuard`)**:
   * 5 saniyede 5+ hesap girişi olduğunda **Otomatik Panic Mode (Lockdown)** devreye girer; gelen hesaplar atılır.
   * Discord açılış tarihi 3 günden yeni olan şüpheli hesaplar tespit edilip güvenlik kanalına raporlanır / karantinaya alınır.

9. **Sohbet, Link ve Spam Koruması (`chatGuard`)**:
   * İzinsiz Discord davet linkleri ve phishing bağlantıları anında silinir, atan kullanıcı 10 dakika susturulur.
   * `@everyone`, `@here` ve toplu etiket baskınları anında engellenir.
   * Hızlı flood/spam yapan kullanıcılar otomatik olarak timeout alır.

10. **Otomatik Snapshot & Yedekleme Motoru (`backup`)**:
    * Bot açıldığında ve her 30 dakikada bir tüm kanalları, kategorileri ve rolleri `data/backups/` dizinine yedekler.

---

## 🚀 Kurulum ve Başlatma

1. [.env](file:///c:/Users/pcigd/OneDrive/Belgeler/GitHub/piyader.rp.security.bot/.env) dosyasını açıp bilgilerinizi girin:
   ```env
   BOT_TOKEN=YOUR_BOT_TOKEN
   GUILD_ID=YOUR_SERVER_ID
   GİLD_İD=YOUR_SERVER_ID
   OWNER_ID=YOUR_DISCORD_USER_ID
   SECURITY_LOG_CHANNEL_ID=YOUR_SECURITY_LOG_CHANNEL_ID
   ```

2. **Discord Developer Portal Ayarları**:
   * Botunuzun **Privileged Gateway Intents** sayfasından:
     * ✅ **Server Members Intent**
     * ✅ **Message Content Intent**
     seçeneklerini **AÇIK (Enabled)** konuma getirin.

3. **Sunucu Rol Hiyerarşisi (ÇOK ÖNEMLİ)**:
   * Discord Sunucu Ayarları > Roller sekmesinde, **Güvenlik Botunun Rolünü en üst sıraya taşıyın**. Bot, kendisinden üstte veya eşit seviyedeki rolleri yönetemez.

4. **Botu Başlatın**:
   ```bash
   npm start
   ```