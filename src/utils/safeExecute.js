/**
 * Güvenli Çalıştırma Sarmalayıcısı (Safe Execution Boundary)
 * Discord API ve ağ hatalarının botu çökertmesini (crash) %100 oranında önler.
 */

// Yaygın Discord API Hata Kodları
const DISCORD_ERROR_CODES = {
  UNKNOWN_CHANNEL: 10003,
  UNKNOWN_GUILD: 10004,
  UNKNOWN_MEMBER: 10007,
  UNKNOWN_MESSAGE: 10008,
  UNKNOWN_ROLE: 10011,
  UNKNOWN_WEBHOOK: 10015,
  UNKNOWN_EMOJI: 10014,
  UNKNOWN_BAN: 10026,
  MISSING_ACCESS: 50001,
  INVALID_FORM_BODY: 50035,
  MISSING_PERMISSIONS: 50013,
  CANNOT_EXECUTE_ON_DM: 50003,
  CANNOT_EDIT_STICKER: 50080
};

/**
 * Bir async fonksiyonu güvenle çalıştırır, bilinen API hatalarını yönetir.
 * @template T
 * @param {() => Promise<T>} fn
 * @param {string} contextLabel Hata loglarında gösterilecek bağlam
 * @param {object} [options]
 * @param {number} [options.retries=0] Yeniden deneme sayısı
 * @param {number} [options.retryDelay=1000] Denemeler arası bekleme süresi (ms)
 * @returns {Promise<{success: boolean, data?: T, error?: Error}>}
 */
async function safeExecute(fn, contextLabel = 'Operation', options = {}) {
  const { retries = 0, retryDelay = 1000 } = options;

  let attempt = 0;
  while (true) {
    try {
      const data = await fn();
      return { success: true, data };
    } catch (err) {
      attempt++;

      // Discord Hata Kodları Kontrolü
      const code = err.code || (err.rawError ? err.rawError.code : null);

      if (code === DISCORD_ERROR_CODES.MISSING_PERMISSIONS) {
        console.warn(`[GÜVENLİ HATA - Yetki Yetersiz] ${contextLabel}: Botun bu işlemi yapmaya yetkisi yok (Rolü en üste taşıyın).`);
        return { success: false, error: err };
      }

      if (code === DISCORD_ERROR_CODES.UNKNOWN_MESSAGE ||
          code === DISCORD_ERROR_CODES.UNKNOWN_CHANNEL ||
          code === DISCORD_ERROR_CODES.UNKNOWN_ROLE ||
          code === DISCORD_ERROR_CODES.UNKNOWN_MEMBER) {
        // Hedef zaten silinmiş veya bulunamıyor, normal durum
        console.debug(`[GÜVENLİ BİLGİ] ${contextLabel}: Hedef varlık zaten mevcut değil (${code}).`);
        return { success: false, error: err };
      }

      // 429 Rate Limit durumunda bekle ve tekrar dene
      if (err.status === 429 || (err.message && err.message.includes('rate limit'))) {
        const retryAfter = err.retryAfter ? (err.retryAfter * 1000) : 2000;
        console.warn(`[RATE LIMIT] ${contextLabel}: Discord rate limit uyguladı. ${retryAfter}ms bekleniyor...`);
        if (attempt <= retries + 1) {
          await new Promise(res => setTimeout(res, retryAfter));
          continue;
        }
      }

      if (attempt <= retries) {
        console.warn(`[TEKRAR DENENİYOR (${attempt}/${retries})] ${contextLabel}: ${err.message}`);
        await new Promise(res => setTimeout(res, retryDelay));
        continue;
      }

      // Beklenmeyen hata - asla çökme yapmaz, güvenli şekilde raporlar
      console.error(`[GÜVENLİK İSTİSNASI YAKALANDI] ${contextLabel}:`, err.message);
      return { success: false, error: err };
    }
  }
}

module.exports = {
  safeExecute,
  DISCORD_ERROR_CODES
};
