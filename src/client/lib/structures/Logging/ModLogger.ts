import { Collection, MessageAttachment, MessageEmbed, WebhookClient } from "discord.js";
import type { Client } from "../../../";

interface Queue {
	embeds: MessageEmbed[];
	attachments: MessageAttachment[];
	guildId: string;
}

export class ModLogger {
	public queue = new Collection<string, Queue>();
	public timeouts = new Collection<string, NodeJS.Timeout>();

	public constructor(public client: Client) {}

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
