const fs = require('fs');
const path = require('path');
const { ChannelType, PermissionFlagsBits } = require('discord.js');

const BACKUP_DIR = path.join(__dirname, '../../data/backups');

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

/**
 * Sunucudaki tüm kanalların ve rollerin tam yedeğini alır.
 * @param {import('discord.js').Guild} guild
 */
async function takeFullBackup(guild) {
  try {
    ensureBackupDir();

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

    fs.writeFileSync(path.join(BACKUP_DIR, 'roles.json'), JSON.stringify(rolesData, null, 2), 'utf8');
    fs.writeFileSync(path.join(BACKUP_DIR, 'channels.json'), JSON.stringify(channelsData, null, 2), 'utf8');

    console.log(`[Yedekleme Tamamlandı] ${rolesData.length} rol ve ${channelsData.length} kanal başarıyla arşivlendi.`);
  } catch (error) {
    console.error('[takeFullBackup Hatası]', error);
  }
}

/**
 * Silinen bir kanalı yedeğinden bulup geri oluşturur.
 * @param {import('discord.js').Guild} guild
 * @param {string} channelId
 * @param {import('discord.js').GuildChannel} [fallbackChannel]
 */
async function restoreChannel(guild, channelId, fallbackChannel = null) {
  try {
    const filePath = path.join(BACKUP_DIR, 'channels.json');
    let channelBackup = null;

    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      channelBackup = data.find(c => c.id === channelId);
    }

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

    const restoredChannel = await guild.channels.create(options);
    console.log(`[Kanal Geri Yüklendi] #${name} (${restoredChannel.id})`);
    return restoredChannel;
  } catch (error) {
    console.error('[restoreChannel Hatası]', error);
    return null;
  }
}

/**
 * Silinen bir rolü yedeğinden bulup geri oluşturur.
 * @param {import('discord.js').Guild} guild
 * @param {string} roleId
 * @param {import('discord.js').Role} [fallbackRole]
 */
async function restoreRole(guild, roleId, fallbackRole = null) {
  try {
    const filePath = path.join(BACKUP_DIR, 'roles.json');
    let roleBackup = null;

    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      roleBackup = data.find(r => r.id === roleId);
    }

    const name = roleBackup ? roleBackup.name : (fallbackRole ? fallbackRole.name : 'kurtarilan-rol');
    const color = roleBackup ? roleBackup.color : (fallbackRole ? fallbackRole.hexColor : '#99aab5');
    const hoist = roleBackup ? roleBackup.hoist : (fallbackRole ? fallbackRole.hoist : false);
    const mentionable = roleBackup ? roleBackup.mentionable : (fallbackRole ? fallbackRole.mentionable : false);
    const permissions = roleBackup ? BigInt(roleBackup.permissions) : (fallbackRole ? fallbackRole.permissions.bitfield : 0n);

    const restoredRole = await guild.roles.create({
      name,
      color,
      hoist,
      mentionable,
      permissions,
      reason: '[Piyader RP Güvenlik] Yetkisiz silinen rol otomatik geri yüklendi'
    });

    console.log(`[Rol Geri Yüklendi] @${name} (${restoredRole.id})`);
    return restoredRole;
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
