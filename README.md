# 🛡️ Piyader RP - Zero-Crash Yüksek Seviye Güvenlik & Hafıza Botu

Piyader RP sunucusu için geliştirilmiş; **sıfır-çökme (zero-crash)** mimarisine sahip, sunucudaki her olayı kalıcı hafızasında saklayan (SQLite WAL Persistent Engine), kademeli ceza ve otomatik geri yükleme yetenekli profesyonel Discord güvenlik botu.

---

## 📋 Muaf Tutulan (Whitelist) Roller

Aşağıdaki roller bütün koruma ve limit kurallarından otomatik olarak **tam muaf** tutulmuştur:

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

*Not: Sunucu sahibi (`guild.ownerId`), botun kendisi ve `.env` dosyasındaki `OWNER_ID` her zaman tam dokunulmazlığa sahiptir.*

---

## 🚂 Railway Üzerinde Kalıcı Veri Dosyası (Volume) Nasıl Oluşturulur?

Railway'de standart konteynerler geçicidir (ephemeral). Botun yeniden başlatmalarda veya güncellemelerde **hafızasını kaybetmemesi için Railway Volume** bağlanmalıdır:

### Adım Adım Kurulum:
1. **Railway Kontrol Paneline Girin:** [railway.com](https://railway.com) üzerinden projenizi ve bot servisinizi açın.
2. **Volumes Sekmesine Gidin:** Bot servisinizin ayarlarında **Settings** veya üst sekmelerden **Volumes** bölümüne tıklayın.
3. **Yeni Volume Ekleyin:** **"+ New Volume"** veya **"Add Volume"** butonuna basın.
4. **Mount Path (Bağlama Yolu) Belirleyin:**
   * Mount Path alanına tam olarak şunu yazın:
     ```text
     /app/data
     ```
5. **Environment Variables (Değişkenler) Bölümüne Ekleyin:**
   * Servisinizin **Variables** sekmesinde şu değişkeni tanımlayın:
     ```env
     DATA_DIR=/app/data
     ```
6. **Deploy / Yeniden Başlat:** Servisiniz deploy olduğunda bot `/app/data/security_vault.db` dosyasını kalıcı SSD disk üzerinde oluşturacak ve sunucu yeniden başlasa dahi **hiçbir log, sabıka ve yedek silinmeyecektir!**

---

## 🧠 Profesyonel Hafıza ve Güvenlik Mimarisi

1. **Olay Günlüğü (Event Journal):**
   * Silinen her kanal, rol, ban, kick, webhook, spam ve raid denemesi zaman damgası, fail ID'si ve yapılan işlemle kalıcı SQLite veritabanına kaydedilir.
2. **Sabıka Kütüğü (Offender Profiler):**
   * Her kullanıcının ihlal geçmişi hafızada tutulur.
   * **Kademeli Ceza Sistemi:**
     * **1. İhlal (Strike 1):** 15 dakika Timeout (Susturma) & İhtar.
     * **2. İhlal (Strike 2):** Tüm rolleri çekme, karantinaya alma ve 24 saat Timeout.
     * **3. İhlal (Strike 3):** Sunucudan kalıcı Yasaklama (Ban).
     * *Not: Kanal/Rol silme veya Mass Ban gibi kritik suçlarda strike beklemeden anında Ban uygulanır!*
3. **Snapshot Yedekleme Motoru:**
   * Bot her 30 dakikada bir tüm kanalları (özel izinleri/overwrites dahil) ve rolleri yedekler. Silinen bir varlık olursa anında bu yedekten geri yüklenir.
4. **Sıfır Çökme Kalkanı (Zero-Crash Boundary):**
   * Discord API'den gelebilecek `50013` (Yetki Yetersiz), `10008` (Mesaj Bulunamadı), `429` (Rate Limit) gibi hatalar `safeExecute` katmanıyla güvenle yutulur ve bot asla çökmez.
5. **Bellek Sızıntısı Önleyici (Cache Sweeper):**
   * Bellekteki geçici spam haritaları her 5 dakikada bir temizlenir, bot aylarca açık kalsa dahi RAM kullanımı stabil kalır.

---

## 🎮 Discord Slash Komutları

Yöneticiler ve whitelist roller Discord içinden botun hafızasını canlı sorgulayabilir:

* `/guvenlik-durum`: Hafıza motoru durumunu, RAM kullanımını, engellenen saldırı sayısını ve bot sağlığını gösterir.
* `/sabika-sorgula <kullanici>`: Seçilen kullanıcının geçmişteki ihlallerini, strike sayısını ve aldığı cezaları döker.
* `/son-olaylar`: Veritabanındaki son 10 güvenlik olayını ve uygulanan önlemleri listeler.

---

## ⚙️ Değişkenler (.env / Railway Variables)

```env
BOT_TOKEN=YOUR_BOT_TOKEN
GUILD_ID=YOUR_SERVER_ID
GİLD_İD=YOUR_SERVER_ID
OWNER_ID=YOUR_DISCORD_USER_ID
SECURITY_LOG_CHANNEL_ID=YOUR_SECURITY_LOG_CHANNEL_ID
DATA_DIR=/app/data
QUARANTINE_ROLE_ID=
```