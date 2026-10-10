const { AuditLogEvent, PermissionFlagsBits } = require('discord.js');
const { isWhitelisted } = require('../utils/whitelist');
const { getLatestAuditLog } = require('../utils/audit');
const { punishUser } = require('../utils/punisher');
const { restoreRole } = require('../utils/backup');
const { sendSecurityLog } = require('../utils/logger');
const { safeExecute } = require('../utils/safeExecute');
const config = require('../../config');

const DANGEROUS_PERMISSIONS = [
  PermissionFlagsBits.Administrator,
  PermissionFlagsBits.ManageGuild,
  PermissionFlagsBits.ManageRoles,
  PermissionFlagsBits.ManageChannels,
  PermissionFlagsBits.BanMembers,
  PermissionFlagsBits.KickMembers,
  PermissionFlagsBits.MentionEveryone
];

/**
 * Rol Koruması Modülü
 * @param {import('discord.js').Client} client
 */
module.exports = function roleGuard(client) {
  // 1. ROL SİLME KORUMASI
  client.on('roleDelete', async role => {
    if (!role.guild || (config.guildId && role.guild.id !== config.guildId)) return;
    const guild = role.guild;

    const entry = await getLatestAuditLog(guild, AuditLogEvent.RoleDelete, role.id);
    if (!entry || !entry.executor) return;

    const executor = entry.executor;
    if (await isWhitelisted(executor, guild)) return;

    console.warn(`[GÜVENLİK İHLALİ] Yetkisiz rol silindi: @${role.name} by ${executor.tag}`);

    // Cezalandır & Hafızaya Yaz
    await punishUser(guild, executor, `Yetkisiz rol silme eylemi: @${role.name}`, {
      ban: true,
      eventType: 'ROLE_DELETE'
    });

    // Rolü Yeniden Oluştur
    if (config.backup.restoreOnDelete) {
      await restoreRole(guild, role.id, role);
    }

    await sendSecurityLog(guild, {
      title: '🚨 ROL SİLME SALDIRISI ENGELLENDİ',
      description: `Yetkisiz bir kullanıcı rol sildi! Olay hafızaya kaydedildi, saldırgan cezalandırıldı ve rol geri yüklendi.`,
      severity: 'CRITICAL',
      executor: executor,
      fields: [
        { name: 'Silinen Rol', value: `\`@${role.name}\` (\`${role.id}\`)`, inline: true },
        { name: 'Rol Rengi', value: `${role.hexColor}`, inline: true },
        { name: 'Alınan Önlem', value: 'Saldırgan yasaklandı, rol yeniden açıldı.', inline: false }
      ]
    });
  });

  // 2. ROL OLUŞTURMA KORUMASI
  client.on('roleCreate', async role => {
    if (!role.guild || (config.guildId && role.guild.id !== config.guildId)) return;
    const guild = role.guild;

    const entry = await getLatestAuditLog(guild, AuditLogEvent.RoleCreate, role.id);
    if (!entry || !entry.executor) return;

    const executor = entry.executor;
    if (await isWhitelisted(executor, guild)) return;

    console.warn(`[GÜVENLİK İHLALİ] Yetkisiz rol oluşturuldu: @${role.name} by ${executor.tag}`);

    // İzinsiz açılan rolü hemen güvenle sil
    await safeExecute(() => role.delete('[Piyader RP Güvenlik] Yetkisiz rol açma engellendi'), 'Delete Unauthorized Role');

    // Cezalandır
    await punishUser(guild, executor, `Yetkisiz rol oluşturma eylemi: @${role.name}`, {
      timeout: true,
      eventType: 'ROLE_CREATE'
    });

    await sendSecurityLog(guild, {
      title: '⚠️ İZİNSİZ ROL OLUŞTURMA ENGELLENDİ',
      description: `Yetkisiz bir kullanıcı yeni bir rol oluşturmaya çalıştı. Rol imha edildi.`,
      severity: 'DANGER',
      executor: executor,
      fields: [
        { name: 'Oluşturulmak İstenen Rol', value: `\`@${role.name}\``, inline: true }
      ]
    });
  });

  // 3. ROL DÜZENLEME & İZİN YÜKSELTME KORUMASI
  client.on('roleUpdate', async (oldRole, newRole) => {
    if (!newRole.guild || (config.guildId && newRole.guild.id !== config.guildId)) return;
    const guild = newRole.guild;

    const entry = await getLatestAuditLog(guild, AuditLogEvent.RoleUpdate, newRole.id);
    if (!entry || !entry.executor) return;

    const executor = entry.executor;
    if (await isWhitelisted(executor, guild)) return;

    // Tehlikeli izin eklenmiş mi kontrolü
    const hadDangerous = DANGEROUS_PERMISSIONS.some(perm => oldRole.permissions.has(perm));
    const nowHasDangerous = DANGEROUS_PERMISSIONS.some(perm => newRole.permissions.has(perm));
    const permissionEscalated = !hadDangerous && nowHasDangerous;

    // Rolü eski ayarlarına güvenle çek
    await safeExecute(() => newRole.edit({
      name: oldRole.name,
      color: oldRole.color,
      hoist: oldRole.hoist,
      permissions: oldRole.permissions,
      mentionable: oldRole.mentionable,
      reason: '[Piyader RP Güvenlik] Yetkisiz rol düzenlemesi geri alındı'
    }), 'Revert Role Edits');

    const reason = permissionEscalated
      ? `Yetkisiz TEHLİKELİ İZİN yükseltme girişimi: @${newRole.name}`
      : `Yetkisiz rol düzenleme eylemi: @${newRole.name}`;

    await punishUser(guild, executor, reason, {
      ban: permissionEscalated,
      timeout: true,
      eventType: permissionEscalated ? 'PERMISSION_ESCALATION' : 'ROLE_UPDATE'
    });

    await sendSecurityLog(guild, {
      title: permissionEscalated ? '🚨 YETKİ GASPI ENGELLENDİ' : '⚠️ İZİNSİZ ROL DÜZENLEMESİ ENGELLENDİ',
      description: permissionEscalated
        ? `Bir kullanıcı role TEHLİKELİ YÖNETİCİ izinleri vermeye çalıştı! İzinler sıfırlandı ve saldırgan yasaklandı.`
        : `Bir kullanıcı rol ayarlarını izinsiz değiştirdi. Rol eski haline getirildi.`,
      severity: permissionEscalated ? 'CRITICAL' : 'WARNING',
      executor: executor,
      fields: [
        { name: 'Rol', value: `\`@${newRole.name}\``, inline: true },
        { name: 'Eski İsim / Renk', value: `\`${oldRole.name}\` / \`${oldRole.hexColor}\``, inline: true },
        { name: 'Yeni İsim / Renk', value: `\`${newRole.name}\` / \`${newRole.hexColor}\``, inline: true }
      ]
    });
  });
};
