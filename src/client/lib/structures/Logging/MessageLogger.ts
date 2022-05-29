import { Collection, MessageAttachment, MessageEmbed, WebhookClient } from "discord.js";
import type { Client } from "../../../";
import { EMBED_DANGER, EMBED_NEUTRAL } from "../../../constants";
import type { GuildMessage } from "../";
import moment from "moment";

interface Queue {
	embeds: MessageEmbed[];
	attachments: MessageAttachment[];
	guildId: string;
}

export class MessageLogger {
	public queue = new Collection<string, Queue>();
	public timeouts = new Collection<string, NodeJS.Timeout>();

	public constructor(public client: Client) {}

	public onMessageDelete(message: GuildMessage) {
		if (message.author.bot || message.webhookId) return;
		const { locale } = this.client.configManager.get(message.guildId);

		const embed = this.client.utils
			.embed()
			.setColor(EMBED_DANGER)
			.setAuthor({
				iconURL: message.member.displayAvatarURL({ dynamic: true, size: 128 }),
				name: `${message.author.tag} (${message.author.id})`
			});

		const title = this.t(locale, "logging:message.delete.title", {
			channel: `#${message.channel.name}`
		});
		const footer = this.t(locale, "logging:message.delete.footer");

		embed
			.setTitle(title)
			.setFooter({ text: footer })
			.setTimestamp()
			.setDescription(message.content ?? this.t(locale, "logging:message.no_content"));

		this.sendLogs(embed, message.guildId);
	}

	public onMessageUpdate(messageOld: GuildMessage, messageNew: GuildMessage) {
		if (messageOld.content === messageNew.content || messageNew.author.bot || messageNew.webhookId) return;
		const { locale } = this.client.configManager.get(messageNew.guildId);

		const embed = this.client.utils
			.embed()
			.setColor(EMBED_NEUTRAL)
			.setAuthor({
				iconURL: messageNew.member.displayAvatarURL({ dynamic: true, size: 128 }),
				name: `${messageNew.author.tag} (${messageNew.author.id})`
			});

		const title = this.t(locale, "logging:message.update.title", {
			channel: `#${messageNew.channel.name}`
		});
		const footer = this.t(locale, "logging:message.update.footer");
		const description = this.t(locale, "logging:message.update.description", {
			message_link: messageNew.url,
			channel_link: `https://discord.com/channels/${messageNew.guildId}/${messageNew.channelId}`
		});
		const beforeTitle = this.t(locale, "logging:message.update.before_title");
		const afterTitle = this.t(locale, "logging:message.update.after_title");

		const oldContent = messageOld.content.substring(0, 2e3);
		const newContent = messageNew.content.substring(0, 2e3);

		embed
			.setTitle(title)
			.setFooter({ text: footer })
			.setTimestamp()
			.setDescription(description)
			.addFields({ name: `➤ ${beforeTitle}`, value: oldContent }, { name: `➤ ${afterTitle}`, value: newContent });

		this.sendLogs(embed, messageNew.guildId);
	}

	public onMessageDeleteBulk(messagesCol: Collection<string, GuildMessage>) {
		const messages = messagesCol.filter((msg) => !msg.author.bot && !msg.webhookId && Boolean(msg.guild));
		if (!messages.size) return;

		const message = messages.first()!;
		const { locale } = this.client.configManager.get(message.guildId);
		const embed = this.client.utils.embed().setColor(EMBED_DANGER);

		const title = this.t(locale, "logging:message.delete_bulk.title", {
			channel: `#${message.channel.name}`
		});
		const footer = this.t(locale, "logging:message.delete_bulk.footer");
		const description = this.t(locale, "logging:message.delete_bulk.description", {
			channel_link: `https://discord.com/channels/${message.guildId}/${message.channelId}`
		});

		const content = messages.reverse().reduce((str, msg) => {
			const attachments = msg.attachments.map((attachment) => `\r\n↳ Attachment: ${attachment.url}`).join("");
			const date = moment(msg.createdTimestamp).utc().format("MMMM Do YYYY, h:mm:ss a");
			const messageContent = msg.cleanContent ? msg.cleanContent.replace(/\n/g, "\r\n") : "-";

			return (str += `[${date} (UTC)] - ${msg.author.tag} (${msg.author.id}): ${messageContent}${attachments}\r\n\r\n`);
		}, "");

		embed.setTitle(title).setFooter({ text: footer }).setTimestamp().setDescription(description);
		const transcript = new MessageAttachment(Buffer.from(content), `logs-${message.channelId}.txt`);

		this.sendLogs(embed, message.guildId, transcript);
	}

	public sendLogs(embed: MessageEmbed, guildId: string, attachment?: MessageAttachment) {
		const collection = this.queue.get(guildId) || { embeds: [], attachments: [], guildId };
		if (attachment) collection.attachments.push(attachment);
		collection.embeds.push(embed);

		this.queue.set(guildId, collection);
		this.setTimeout(guildId);
	}

	private setTimeout(guildId: string) {
		if (!this.timeouts.has(guildId)) {
			const timeout = setTimeout(() => this.sendRequest(guildId), 3e3);
			this.timeouts.set(guildId, timeout);
		}
	}

	private async sendRequest(guildId: string) {
		const collection = this.queue.get(guildId);
		if (!collection) return;

		this.queue.delete(guildId);
		this.timeouts.delete(guildId);

		const {
			logging: { messageEnabled, messageWebhook }
		} = this.client.configManager.get(guildId);
		if (!messageEnabled || !messageWebhook) return;

		try {
			const chunkSize = 10;
			const groups = collection.embeds
				.map((_, i) => (i % chunkSize === 0 ? collection.embeds.slice(i, i + chunkSize) : null))
				.filter((e) => e) as MessageEmbed[][];

			const embedChunks: MessageEmbed[][] = [];
			groups.forEach((g) => {
				let count = 0;
				let arr: MessageEmbed[] = [];

				g.forEach((m) => {
					count += m.length;
					if (count >= 6e3) {
						embedChunks.push(arr);
						count = m.length;
						arr = [m];
					} else {
						arr.push(m);
					}
				});

				embedChunks.push(arr);
			});

			const webhook = new WebhookClient({ url: messageWebhook });
			await Promise.all(
				embedChunks.map(async (embeds, index) => {
					const files: MessageAttachment[] = [];
					if (embedChunks.length === index + 1) files.push(...collection.attachments);

					const avatarURL = this.client.user?.displayAvatarURL({ size: 4096 });
					await webhook.send({ avatarURL, embeds, files }).catch(() => void 0);
				})
			);
		} catch (e) {}
	}

	private get t() {
		return this.client.localeManager.translate.bind(this.client.localeManager);
	}
}
