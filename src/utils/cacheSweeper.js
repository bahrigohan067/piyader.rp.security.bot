/**
 * Bellek Sızıntısı Önleyici (Memory & TTL Cache Sweeper)
 * Harici spam haritalarını, raid tamponlarını ve geçici verileri temizleyerek
 * botun RAM kullanımının şişmesini ve OOM (Out-Of-Memory) çökmesini önler.
 */

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 dakikada bir

/**
 * Otomatik bellek temizleyicisini başlatır.
 * @param {Array<Map<any, any> | Set<any>>} collectionsToSweep
 */
function startCacheSweeper(collectionsToSweep = []) {
  setInterval(() => {
    try {
      const memoryUsage = process.memoryUsage();
      const heapUsedMb = Math.round(memoryUsage.heapUsed / 1024 / 1024);
      const rssMb = Math.round(memoryUsage.rss / 1024 / 1024);

      console.log(`[HAFIZA SAĞLIK RAPORU] Heap: ${heapUsedMb}MB | RSS: ${rssMb}MB`);

      for (const col of collectionsToSweep) {
        if (col instanceof Map && col.size > 2000) {
          col.clear();
          console.debug('[Cache Sweeper] Aşırı dolan Map temizlendi.');
        } else if (col instanceof Set && col.size > 2000) {
          col.clear();
          console.debug('[Cache Sweeper] Aşırı dolan Set temizlendi.');
        }
      }
    } catch (err) {
      console.error('[Cache Sweeper Hatası]', err.message);
    }
  }, CLEANUP_INTERVAL_MS).unref();
}

module.exports = {
  startCacheSweeper
};
