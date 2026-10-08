const fs = require('fs');
const path = require('path');
const config = require('../../config');

let dbInstance = null;
let isUsingSqlite = false;

// Fallback JSON veri yapısı (SQLite kullanılamazsa devreye girer)
const fallbackStorage = {
  events: [],
  offenders: {},
  snapshots: [],
  metrics: {}
};

/**
 * Kalıcı depolama dizinini hazırlar ve SQLite veritabanını başlatır.
 */
function initDatabase() {
  if (dbInstance) return dbInstance;

  const dataDir = path.resolve(config.dataDir);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log(`[HAFIZA DİZİNİ OLUŞTURULDU] Yol: ${dataDir}`);
  }

  // 1. Modern Node.js node:sqlite kontrolü
  try {
    const { DatabaseSync } = require('node:sqlite');
    const dbFilePath = path.join(dataDir, 'security_vault.db');

    const db = new DatabaseSync(dbFilePath);

    // Performans ve çökme direnci için WAL modu
    try {
      db.exec('PRAGMA journal_mode = WAL;');
      db.exec('PRAGMA synchronous = NORMAL;');
    } catch (e) {
      // WAL bazı ortamlarda desteklenmeyebilir, devam et
    }

    // Tabloları oluştur
    db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        event_type TEXT NOT NULL,
        severity TEXT NOT NULL,
        executor_id TEXT,
        executor_tag TEXT,
        target_id TEXT,
        details TEXT,
        action_taken TEXT,
        success INTEGER DEFAULT 1
      );

      CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
      CREATE INDEX IF NOT EXISTS idx_events_executor ON events(executor_id);
      CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);

      CREATE TABLE IF NOT EXISTS offenders (
        user_id TEXT PRIMARY KEY,
        username TEXT,
        violation_count INTEGER DEFAULT 1,
        first_violation INTEGER NOT NULL,
        last_violation INTEGER NOT NULL,
        last_reason TEXT,
        history_json TEXT,
        is_banned INTEGER DEFAULT 0,
        is_quarantined INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        guild_id TEXT NOT NULL,
        snapshot_type TEXT NOT NULL,
        data_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS metrics (
        key TEXT PRIMARY KEY,
        value INTEGER DEFAULT 0,
        updated_at INTEGER NOT NULL
      );
    `);

    isUsingSqlite = true;
    dbInstance = db;
    console.log(`[HAFIZA MOTORU AKTİF - SQLITE WAL] Kalıcı Veritabanı: ${dbFilePath}`);
    return dbInstance;
  } catch (err) {
    console.warn(`[SQLITE YÜKLENEMEDİ - ATOMİK JSON FALLBACK AKTİF]`, err.message);
    isUsingSqlite = false;
    loadFallbackJson(dataDir);
    return null;
  }
}

function loadFallbackJson(dataDir) {
  const jsonPath = path.join(dataDir, 'security_vault.json');
  if (fs.existsSync(jsonPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      Object.assign(fallbackStorage, parsed);
    } catch (e) {
      console.error('[Fallback JSON Okuma Hatası]', e.message);
    }
  }
}

function saveFallbackJson() {
  if (isUsingSqlite) return;
  const dataDir = path.resolve(config.dataDir);
  const jsonPath = path.join(dataDir, 'security_vault.json');
  const tempPath = path.join(dataDir, `security_vault.tmp.${Date.now()}`);

  try {
    fs.writeFileSync(tempPath, JSON.stringify(fallbackStorage, null, 2), 'utf8');
    fs.renameSync(tempPath, jsonPath);
  } catch (e) {
    console.error('[Fallback Atomik Yazma Hatası]', e.message);
  }
}

module.exports = {
  initDatabase,
  getDb: () => dbInstance || initDatabase(),
  isSqliteActive: () => isUsingSqlite,
  getFallbackStorage: () => fallbackStorage,
  saveFallbackJson
};
