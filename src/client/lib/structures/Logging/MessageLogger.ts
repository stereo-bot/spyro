import { Collection, MessageEmbed, WebhookClient } from "discord.js";
import type { Client } from "../../../";
import { EMBED_DANGER } from "../../../constants";
import type { GuildMessage } from "../";

interface Queue {
	embeds: MessageEmbed[];
	guildId: string;
}

export class MessageLogger {
	public queue = new Collection<string, Queue>();
	public timeouts = new Collection<string, NodeJS.Timeout>();

	public constructor(public client: Client) {}

	public onMessageDelete(message: GuildMessage) {
		const locale = message.guild.preferredLocale;

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

	public sendLogs(embed: MessageEmbed, guildId: string) {
		const collection = this.queue.get(guildId) || { embeds: [], guildId };
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

			const embeds: MessageEmbed[][] = [];
			groups.forEach((g) => {
				let count = 0;
				let arr: MessageEmbed[] = [];

				g.forEach((m) => {
					count += m.length;
					if (count >= 6e3) {
						embeds.push(arr);
						count = m.length;
						arr = [m];
					} else {
						arr.push(m);
					}
				});

				embeds.push(arr);
			});

			const webhook = new WebhookClient({ url: messageWebhook });
			await Promise.all(
				embeds.map((embed) =>
					webhook
						.send({
							avatarURL: this.client.user?.displayAvatarURL({ size: 4096 }),
							embeds: embed
						})
						.catch(() => void 0)
				)
			);
		} catch (e) {}
	}

	private get t() {
		return this.client.localeManager.translate.bind(this.client.localeManager);
	}
}
