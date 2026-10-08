const { getDb, isSqliteActive, getFallbackStorage, saveFallbackJson } = require('./db');

/**
 * Güvenlik Hafıza Yöneticisi (Security Memory Manager)
 * Botun sunucudaki her olayı, ihlali, saldırganı ve yedeği kalıcı olarak hatırlamasını sağlar.
 */

/**
 * Güvenlik olayını kalıcı hafızaya kaydeder.
 * @param {object} event
 * @param {string} event.eventType Örn: CHANNEL_DELETE, ROLE_DELETE, MASS_BAN, RAID_ATTACK, SPAM_FLOOD
 * @param {'INFO'|'WARNING'|'DANGER'|'CRITICAL'} event.severity
 * @param {string} [event.executorId]
 * @param {string} [event.executorTag]
 * @param {string} [event.targetId]
 * @param {string} [event.details]
 * @param {string} [event.actionTaken]
 * @param {boolean} [event.success=true]
 */
function logEvent(event) {
  const timestamp = Date.now();
  const {
    eventType,
    severity = 'WARNING',
    executorId = null,
    executorTag = null,
    targetId = null,
    details = '',
    actionTaken = '',
    success = true
  } = event;

  try {
    if (isSqliteActive()) {
      const db = getDb();
      const stmt = db.prepare(`
        INSERT INTO events (timestamp, event_type, severity, executor_id, executor_tag, target_id, details, action_taken, success)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(timestamp, eventType, severity, executorId, executorTag, targetId, details, actionTaken, success ? 1 : 0);

      // Metrikleri güncelle
      incrementMetric('total_events');
      if (['DANGER', 'CRITICAL'].includes(severity)) {
        incrementMetric('blocked_attacks');
      }
    } else {
      const storage = getFallbackStorage();
      storage.events.push({
        id: storage.events.length + 1,
        timestamp,
        eventType,
        severity,
        executorId,
        executorTag,
        targetId,
        details,
        actionTaken,
        success
      });
      saveFallbackJson();
    }
  } catch (error) {
    console.error('[Memory logEvent Hatası]', error.message);
  }
}

/**
 * Bir kullanıcının kural ihlalini sabıka kaydına (offenders) işler ve güncel ceza derecesini döner.
 * @param {string} userId
 * @param {string} username
 * @param {string} reason
 * @param {string} actionTaken
 * @returns {{violationCount: number, isFirst: boolean, isBanned: boolean}}
 */
function recordViolation(userId, username, reason, actionTaken) {
  const timestamp = Date.now();

  try {
    if (isSqliteActive()) {
      const db = getDb();
      const existing = db.prepare('SELECT * FROM offenders WHERE user_id = ?').get(userId);

      if (existing) {
        let history = [];
        try {
          history = JSON.parse(existing.history_json || '[]');
        } catch (e) {}

        history.push({ timestamp, reason, actionTaken });

        const newCount = existing.violation_count + 1;
        db.prepare(`
          UPDATE offenders
          SET username = ?, violation_count = ?, last_violation = ?, last_reason = ?, history_json = ?
          WHERE user_id = ?
        `).run(username, newCount, timestamp, reason, JSON.stringify(history), userId);

        return {
          violationCount: newCount,
          isFirst: false,
          isBanned: existing.is_banned === 1
        };
      } else {
        const history = [{ timestamp, reason, actionTaken }];
        db.prepare(`
          INSERT INTO offenders (user_id, username, violation_count, first_violation, last_violation, last_reason, history_json)
          VALUES (?, ?, 1, ?, ?, ?, ?)
        `).run(userId, username, timestamp, timestamp, reason, JSON.stringify(history));

        return {
          violationCount: 1,
          isFirst: true,
          isBanned: false
        };
      }
    } else {
      const storage = getFallbackStorage();
      if (!storage.offenders[userId]) {
        storage.offenders[userId] = {
          userId,
          username,
          violationCount: 1,
          firstViolation: timestamp,
          lastViolation: timestamp,
          lastReason: reason,
          history: [{ timestamp, reason, actionTaken }]
        };
        saveFallbackJson();
        return { violationCount: 1, isFirst: true, isBanned: false };
      } else {
        const off = storage.offenders[userId];
        off.violationCount += 1;
        off.lastViolation = timestamp;
        off.lastReason = reason;
        off.history.push({ timestamp, reason, actionTaken });
        saveFallbackJson();
        return { violationCount: off.violationCount, isFirst: false, isBanned: false };
      }
    }
  } catch (error) {
    console.error('[Memory recordViolation Hatası]', error.message);
    return { violationCount: 1, isFirst: false, isBanned: false };
  }
}

/**
 * Bir kullanıcının geçmiş sabıka kaydını getirir.
 * @param {string} userId
 */
function getOffender(userId) {
  try {
    if (isSqliteActive()) {
      const db = getDb();
      const row = db.prepare('SELECT * FROM offenders WHERE user_id = ?').get(userId);
      if (!row) return null;
      let history = [];
      try { history = JSON.parse(row.history_json || '[]'); } catch (e) {}
      return { ...row, history };
    } else {
      const storage = getFallbackStorage();
      return storage.offenders[userId] || null;
    }
  } catch (e) {
    console.error('[Memory getOffender Hatası]', e.message);
    return null;
  }
}

/**
 * Son N adet güvenlik olayını çeker.
 * @param {number} limit
 */
function getRecentEvents(limit = 10) {
  try {
    if (isSqliteActive()) {
      const db = getDb();
      return db.prepare('SELECT * FROM events ORDER BY timestamp DESC LIMIT ?').all(limit);
    } else {
      const storage = getFallbackStorage();
      return storage.events.slice(-limit).reverse();
    }
  } catch (e) {
    console.error('[Memory getRecentEvents Hatası]', e.message);
    return [];
  }
}

/**
 * Sistem yedeğini kalıcı veri tabanına kaydeder.
 * @param {string} guildId
 * @param {'CHANNELS'|'ROLES'|'FULL'} snapshotType
 * @param {any} data
 */
function saveSnapshot(guildId, snapshotType, data) {
  const timestamp = Date.now();
  const dataJson = typeof data === 'string' ? data : JSON.stringify(data);

  try {
    if (isSqliteActive()) {
      const db = getDb();
      db.prepare(`
        INSERT INTO snapshots (timestamp, guild_id, snapshot_type, data_json)
        VALUES (?, ?, ?, ?)
      `).run(timestamp, guildId, snapshotType, dataJson);
    } else {
      const storage = getFallbackStorage();
      storage.snapshots.push({ timestamp, guildId, snapshotType, data });
      saveFallbackJson();
    }
  } catch (e) {
    console.error('[Memory saveSnapshot Hatası]', e.message);
  }
}

/**
 * En son kaydedilmiş sunucu yedeğini getirir.
 * @param {string} guildId
 * @param {'CHANNELS'|'ROLES'|'FULL'} snapshotType
 */
function getLatestSnapshot(guildId, snapshotType) {
  try {
    if (isSqliteActive()) {
      const db = getDb();
      const row = db.prepare(`
        SELECT * FROM snapshots
        WHERE guild_id = ? AND snapshot_type = ?
        ORDER BY timestamp DESC LIMIT 1
      `).get(guildId, snapshotType);
      if (!row) return null;
      return JSON.parse(row.data_json);
    } else {
      const storage = getFallbackStorage();
      const found = storage.snapshots
        .filter(s => s.guildId === guildId && s.snapshotType === snapshotType)
        .pop();
      return found ? found.data : null;
    }
  } catch (e) {
    console.error('[Memory getLatestSnapshot Hatası]', e.message);
    return null;
  }
}

function incrementMetric(key) {
  const now = Date.now();
  try {
    if (isSqliteActive()) {
      const db = getDb();
      db.prepare(`
        INSERT INTO metrics (key, value, updated_at)
        VALUES (?, 1, ?)
        ON CONFLICT(key) DO UPDATE SET value = value + 1, updated_at = ?
      `).run(key, now, now);
    }
  } catch (e) {}
}

/**
 * Güvenlik istatistikleri özetini döner.
 */
function getSecurityStats() {
  try {
    if (isSqliteActive()) {
      const db = getDb();
      const totalEvents = db.prepare('SELECT COUNT(*) as count FROM events').get().count;
      const totalOffenders = db.prepare('SELECT COUNT(*) as count FROM offenders').get().count;
      const blockedAttacks = db.prepare("SELECT COUNT(*) as count FROM events WHERE severity IN ('DANGER', 'CRITICAL')").get().count;
      return {
        totalEvents,
        totalOffenders,
        blockedAttacks,
        engine: 'SQLite WAL (Persistent)'
      };
    } else {
      const storage = getFallbackStorage();
      return {
        totalEvents: storage.events.length,
        totalOffenders: Object.keys(storage.offenders).length,
        blockedAttacks: storage.events.filter(e => ['DANGER', 'CRITICAL'].includes(e.severity)).length,
        engine: 'Atomic JSON (Persistent)'
      };
    }
  } catch (e) {
    return { totalEvents: 0, totalOffenders: 0, blockedAttacks: 0, engine: 'Error' };
  }
}

module.exports = {
  logEvent,
  recordViolation,
  getOffender,
  getRecentEvents,
  saveSnapshot,
  getLatestSnapshot,
  getSecurityStats
};
