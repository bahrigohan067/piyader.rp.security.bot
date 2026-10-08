const fs = require('fs');
const path = require('path');
const { ChannelType } = require('discord.js');
const config = require('../../config');
const { saveSnapshot, getLatestSnapshot } = require('../memory/memoryManager');
const { safeExecute } = require('./safeExecute');

function getBackupDir() {
  const dir = path.join(path.resolve(config.dataDir), 'backups');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Sunucudaki tüm kanalların ve rollerin tam yedeğini alır ve hem SQLite hafızasına hem diske kaydeder.
 * @param {import('discord.js').Guild} guild
 */
async function takeFullBackup(guild) {
  try {
    const backupDir = getBackupDir();

    // 1. Rolleri Yedekle
    const rolesData = [];
    guild.roles.cache.forEach(role => {
      if (role.id === guild.id) return; // @everyone rolünü atla
      rolesData.push({
        id: role.id,
        name: role.name,
        color: role.hexColor,
        hoist: role.hoist,
        position: role.position,
        permissions: role.permissions.bitfield.toString(),
        mentionable: role.mentionable
      });
    });

    // 2. Kanalları Yedekle
    const channelsData = [];
    guild.channels.cache.forEach(channel => {
      const overwrites = [];
      channel.permissionOverwrites.cache.forEach(ow => {
        overwrites.push({
          id: ow.id,
          type: ow.type,
          allow: ow.allow.bitfield.toString(),
          deny: ow.deny.bitfield.toString()
        });
      });

      channelsData.push({
        id: channel.id,
        name: channel.name,
        type: channel.type,
        parentId: channel.parentId,
        position: channel.position,
        topic: channel.topic || null,
        nsfw: channel.nsfw || false,
        rateLimitPerUser: channel.rateLimitPerUser || 0,
        permissionOverwrites: overwrites
      });
    });

    // Kalıcı Hafıza Motoruna (SQLite) Kaydet
    saveSnapshot(guild.id, 'ROLES', rolesData);
    saveSnapshot(guild.id, 'CHANNELS', channelsData);

    // Atomik JSON Yedek Dosyaları
    fs.writeFileSync(path.join(backupDir, 'roles.json'), JSON.stringify(rolesData, null, 2), 'utf8');
    fs.writeFileSync(path.join(backupDir, 'channels.json'), JSON.stringify(channelsData, null, 2), 'utf8');

    console.log(`[HAFIZA & YEDEKLEME TAMAMLANDI] ${rolesData.length} rol ve ${channelsData.length} kanal arşivlendi.`);
  } catch (error) {
    console.error('[takeFullBackup Hatası]', error);
  }
}

/**
 * Silinen bir kanalı yedeğinden bulup güvenle geri oluşturur.
 * @param {import('discord.js').Guild} guild
 * @param {string} channelId
 * @param {import('discord.js').GuildChannel} [fallbackChannel]
 */
async function restoreChannel(guild, channelId, fallbackChannel = null) {
  try {
    let channels = getLatestSnapshot(guild.id, 'CHANNELS');

    if (!channels) {
      const filePath = path.join(getBackupDir(), 'channels.json');
      if (fs.existsSync(filePath)) {
        channels = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      }
    }

    const channelBackup = Array.isArray(channels) ? channels.find(c => c.id === channelId) : null;

    const name = channelBackup ? channelBackup.name : (fallbackChannel ? fallbackChannel.name : 'kurtarilan-kanal');
    const type = channelBackup ? channelBackup.type : (fallbackChannel ? fallbackChannel.type : ChannelType.GuildText);
    const parent = channelBackup ? channelBackup.parentId : (fallbackChannel ? fallbackChannel.parentId : null);
    const topic = channelBackup ? channelBackup.topic : (fallbackChannel ? fallbackChannel.topic : null);
    const nsfw = channelBackup ? channelBackup.nsfw : false;

    const options = {
      name,
      type,
      parent,
      topic,
      nsfw,
      reason: '[Piyader RP Güvenlik] Yetkisiz silinen kanal otomatik geri yüklendi'
    };

    if (channelBackup && Array.isArray(channelBackup.permissionOverwrites)) {
      options.permissionOverwrites = channelBackup.permissionOverwrites.map(ow => ({
        id: ow.id,
        type: ow.type,
        allow: BigInt(ow.allow),
        deny: BigInt(ow.deny)
      }));
    }

    const result = await safeExecute(
      () => guild.channels.create(options),
      `Restore Channel (#${name})`
    );

    if (result.success) {
      console.log(`[KANAL GERİ YÜKLENDİ] #${name} (${result.data.id})`);
      return result.data;
    }
    return null;
  } catch (error) {
    console.error('[restoreChannel Hatası]', error);
    return null;
  }
}

/**
 * Silinen bir rolü yedeğinden bulup güvenle geri oluşturur.
 * @param {import('discord.js').Guild} guild
 * @param {string} roleId
 * @param {import('discord.js').Role} [fallbackRole]
 */
async function restoreRole(guild, roleId, fallbackRole = null) {
  try {
    let roles = getLatestSnapshot(guild.id, 'ROLES');

    if (!roles) {
      const filePath = path.join(getBackupDir(), 'roles.json');
      if (fs.existsSync(filePath)) {
        roles = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      }
    }

    const roleBackup = Array.isArray(roles) ? roles.find(r => r.id === roleId) : null;

    const name = roleBackup ? roleBackup.name : (fallbackRole ? fallbackRole.name : 'kurtarilan-rol');
    const color = roleBackup ? roleBackup.color : (fallbackRole ? fallbackRole.hexColor : '#99aab5');
    const hoist = roleBackup ? roleBackup.hoist : (fallbackRole ? fallbackRole.hoist : false);
    const mentionable = roleBackup ? roleBackup.mentionable : (fallbackRole ? fallbackRole.mentionable : false);
    const permissions = roleBackup ? BigInt(roleBackup.permissions) : (fallbackRole ? fallbackRole.permissions.bitfield : 0n);

    const result = await safeExecute(
      () => guild.roles.create({
        name,
        color,
        hoist,
        mentionable,
        permissions,
        reason: '[Piyader RP Güvenlik] Yetkisiz silinen rol otomatik geri yüklendi'
      }),
      `Restore Role (@${name})`
    );

    if (result.success) {
      console.log(`[ROL GERİ YÜKLENDİ] @${name} (${result.data.id})`);
      return result.data;
    }
    return null;
  } catch (error) {
    console.error('[restoreRole Hatası]', error);
    return null;
  }
}

module.exports = {
  takeFullBackup,
  restoreChannel,
  restoreRole
};
