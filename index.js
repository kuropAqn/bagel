const { Client, GatewayIntentBits, Events, ChannelType, PermissionsBitField, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ]
});

client.once(Events.ClientReady, () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// VC作成イベント
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  if (!oldState.channel && newState.channel) {
    const vc = newState.channel;

    // 対象がVCでなければ無視
    if (vc.type !== ChannelType.GuildVoice) return;

    // VC作成直後に設定メニュー送信（テキストチャットに）
    const textChannel = vc.guild.channels.cache.find(c => c.name === 'vc-settings' && c.type === ChannelType.GuildText);
    if (!textChannel) return;

    const embed = new EmbedBuilder()
      .setTitle('🔧 VC設定メニュー')
      .setDescription('以下のボタンから各種設定が可能です。')
      .setColor(0x00AE86);

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('change_name').setLabel('チャンネル名変更').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('change_limit').setLabel('人数制限変更').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('change_bitrate').setLabel('ビットレート変更').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('move_member').setLabel('メンバー移動').setStyle(ButtonStyle.Secondary)
    );

    await textChannel.send({ embeds: [embed], components: [buttons] });
  }
});

// ボタン押下時の処理
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton()) return;

  const modal = new ModalBuilder().setCustomId(`modal_${interaction.customId}`).setTitle('設定変更');

  switch (interaction.customId) {
    case 'change_name':
      modal.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('name_input').setLabel('新しいVC名を入力').setStyle(TextInputStyle.Short).setRequired(true)
      ));
      break;

    case 'change_limit':
      modal.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('limit_input').setLabel('人数 (1~99, 0で制限なし)').setStyle(TextInputStyle.Short).setRequired(true)
      ));
      break;

    case 'change_bitrate':
      modal.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('bitrate_input').setLabel('ビットレート (例: 64000)').setStyle(TextInputStyle.Short).setRequired(true)
      ));
      break;

    case 'move_member':
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('user_id').setLabel('移動するユーザーID').setStyle(TextInputStyle.Short)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('vc_id').setLabel('移動先のVC ID').setStyle(TextInputStyle.Short)
        )
      );
      break;
  }

  await interaction.showModal(modal);
});

// モーダル送信後の処理
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isModalSubmit()) return;

  const member = interaction.member;
  const voiceChannel = member.voice.channel;

  if (!voiceChannel) {
    return interaction.reply({ content: 'VCに参加していないため設定できません。', ephemeral: true });
  }

  if (interaction.customId === 'modal_change_name') {
    const name = interaction.fields.getTextInputValue('name_input');
    await voiceChannel.setName(name);
    return interaction.reply({ content: `✅ VC名を「${name}」に変更しました。`, ephemeral: true });

  } else if (interaction.customId === 'modal_change_limit') {
    const limit = parseInt(interaction.fields.getTextInputValue('limit_input'));
    if (isNaN(limit) || limit < 0 || limit > 99) {
      return interaction.reply({ content: '⚠️ 有効な数字(0~99)を入力してください。', ephemeral: true });
    }
    await voiceChannel.setUserLimit(limit === 0 ? 0 : limit);
    return interaction.reply({ content: `✅ 人数制限を${limit === 0 ? 'なし' : limit + '人'}に設定しました。`, ephemeral: true });

  } else if (interaction.customId === 'modal_change_bitrate') {
    const bitrate = parseInt(interaction.fields.getTextInputValue('bitrate_input'));
    if (isNaN(bitrate)) return interaction.reply({ content: '⚠️ 有効なビットレートを入力してください。', ephemeral: true });
    await voiceChannel.setBitrate(bitrate);
    return interaction.reply({ content: `✅ ビットレートを ${bitrate} に変更しました。`, ephemeral: true });

  } else if (interaction.customId === 'modal_move_member') {
    const userId = interaction.fields.getTextInputValue('user_id');
    const vcId = interaction.fields.getTextInputValue('vc_id');
    const userToMove = await interaction.guild.members.fetch(userId).catch(() => null);
    const targetVC = interaction.guild.channels.cache.get(vcId);

    if (!userToMove || !targetVC || targetVC.type !== ChannelType.GuildVoice) {
      return interaction.reply({ content: '⚠️ 無効なユーザーIDまたはVC IDです。', ephemeral: true });
    }

    await userToMove.voice.setChannel(targetVC);
    return interaction.reply({ content: `✅ 指定されたユーザーをVCへ移動しました。`, ephemeral: true });
  }
});

// メッセージに反応してロール付与（オプション）
client.on(Events.MessageCreate, async (message) => {
  const targetChannelId = 'YOUR_CHANNEL_ID';
  const targetRoleId = 'YOUR_ROLE_ID';

  if (message.channel.id === targetChannelId) {
    const member = message.member;
    if (!member.roles.cache.has(targetRoleId)) {
      await member.roles.add(targetRoleId);
      await message.reply(`${member.displayName} にロールを付与しました！`);
    }
  }
});

client.login('token');
