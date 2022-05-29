import { Collection, MessageAttachment, MessageEmbed, WebhookClient } from "discord.js";
import type { Client } from "../../../";
import { EMBED_MOD_EXTREME, EMBED_MOD_HIGH, EMBED_MOD_LOW, EMBED_MOD_MEDIUM } from "../../../constants";
import { ModlogType } from "../../../types";

interface Queue {
	embeds: MessageEmbed[];
	attachments: MessageAttachment[];
	guildId: string;
}

// TODO: use ModLog class instead of this, added with process data PR
interface ModlogData {
	member: {
		tag: string;
		id: string;
	};
	moderator: {
		avatar: string;
		tag: string;
		id: string;
	};
	modlogType: ModlogType;
	locale: string;
	reason: string;
	guildId: string;
	case: number;
	expire?: Date;
}

export class ModLogger {
	public queue = new Collection<string, Queue>();
	public timeouts = new Collection<string, NodeJS.Timeout>();

	public constructor(public client: Client) {}

	public onModAdd(data: ModlogData) {
		const embed = this.client.utils.embed();
		const basePath = "logging:mod.add";

		embed.setAuthor({ iconURL: data.moderator.avatar, name: `${data.moderator.tag} (${data.moderator.id})` });
		embed.setFooter({ text: `Case #${data.case}` }).setTimestamp();
		embed.setDescription(
			[
				this.t(data.locale, `${basePath}.description_member`, { member: data.member.tag }),
				`⤷ <@${data.member.id}> - ${data.member.id}`,
				this.t(data.locale, `${basePath}.description_action`, { action: this.t(data.locale, `common:mod_actions.${data.modlogType}`) }),
				data.expire ? this.t(data.locale, `${basePath}.description_expire`, { expire: `<t:${data.expire.getTime()}:R>` }) : null,
				this.t(data.locale, `${basePath}.description_reason`, { reason: data.reason })
			]
				.filter((str) => typeof str === "string")
				.join("\n")
		);

		switch (data.modlogType) {
			case ModlogType.WARN:
				embed.setColor(EMBED_MOD_LOW);
				break;
			case ModlogType.MUTE:
				embed.setColor(EMBED_MOD_MEDIUM);
				break;
			case ModlogType.KICK:
			case ModlogType.SOFTBAN:
				embed.setColor(EMBED_MOD_HIGH);
				break;
			case ModlogType.BAN:
				embed.setColor(EMBED_MOD_EXTREME);
				break;
		}

		this.sendLogs(embed, data.guildId);
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
