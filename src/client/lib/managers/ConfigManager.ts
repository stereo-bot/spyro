import { Collection } from "discord.js";
import type { Client } from "../..";
import type { FullGuildConfig } from "../../types";

const getMockConfig = (id: string): FullGuildConfig => ({
	automod: {
		guildId: id,
		moduleEnabled: false,
		MuteDuration: 6e2,
		globalWhitelist: [],
		inviteEnabled: true,
		inviteDelete: true,
		inviteAction: "WARN",
		inviteWhitelist: [],
		DupTextEnabled: true,
		DupTextDelete: false,
		DupTextAction: "VERBAL",
		DupTextWhitelist: [],
		SpamEnabled: true,
		SpamDelete: true,
		SpamAction: "MUTE",
		SpamWhitelist: [],
		SpamDuration: 5,
		SpamAmount: 7,
		PhishingEnabled: true,
		PhishingDelete: true,
		PhishingAction: "BAN",
		PhishingWhitelist: [],
		MassMentionEnabled: true,
		MassMentionDelete: true,
		MassMentionAction: "MUTE",
		MassMentionWhitelist: [],
		MassMentionDuration: 5,
		MassMentionAmount: 7,
		ZalgoEnabled: true,
		ZalgoDelete: true,
		ZalgoAction: "WARN",
		ZalgoWhitelist: [],
		BadwordsEnabled: true,
		BadwordsDelete: true,
		BadwordsAction: "WARN",
		BadwordsWhitelist: [],
		BadwordsAllowedList: [],
		BadwordsBlockedList: []
	},
	logging: {
		guildId: id,
		moduleEnabled: false,
		messageEnabled: true,
		messageChannel: null,
		messageWebhook: null,
		modEnabled: true,
		modChannel: null,
		modWebhook: null
	},
	id,
	leaveTimestamp: null
});

interface ConfigTimeout {
	id: string;
	timeout: NodeJS.Timeout;
}

export class ConfigManager {
	public guildConfig = new Collection<string, FullGuildConfig>();
	public timeouts = new Collection<string, ConfigTimeout>();

	public constructor(public client: Client) {}

	public loadAll() {
		this.client.guilds.cache.forEach(async (guild) => {
			let guildConfig = await this.client.prisma.guildConfig.findUnique({
				where: { id: guild.id },
				select: { automod: true, logging: true, id: true }
			});
			if (!guildConfig)
				guildConfig = await this.client.prisma.guildConfig.create({
					data: { id: guild.id, automod: { create: {} }, logging: { create: {} } },
					select: { automod: true, logging: true, id: true }
				});
			this.guildConfig.set(guild.id, guildConfig as unknown as FullGuildConfig);
		});

		this.scheduleDeleteAll();
	}

	public async load(guildId: string) {
		let guildConfig = await this.client.prisma.guildConfig.findUnique({
			where: { id: guildId },
			select: { automod: true, logging: true, id: true }
		});
		if (!guildConfig)
			guildConfig = await this.client.prisma.guildConfig.create({
				data: { id: guildId, automod: { create: {} }, logging: { create: {} } },
				select: { automod: true, logging: true, id: true }
			});
		this.guildConfig.set(guildId, guildConfig as unknown as FullGuildConfig);
	}

	public get(id: string): FullGuildConfig {
		const config = this.guildConfig.get(id);
		if (!config) return getMockConfig(id);

		return config;
	}

	public async update(id: string, data: Partial<FullGuildConfig>) {
		const updated = await this.client.prisma.guildConfig.update({ where: { id }, data, select: { automod: true, id: true, logging: true } });
		this.guildConfig.set(id, updated as FullGuildConfig);

		return updated as FullGuildConfig;
	}

	public scheduleDeleteAll() {
		const deleted = this.guildConfig.filter((g) => Boolean(g.leaveTimestamp) && !this.timeouts.has(g.id));
		deleted.forEach((config) => {
			const getTime = () => {
				const futureDate = config.leaveTimestamp!.getMilliseconds() + 6048e5;
				const now = Date.now();

				return futureDate - now;
			};

			const timeout = setTimeout(async () => {
				await this.client.prisma.guildConfig.update({
					where: { id: config.id },
					data: { automod: { delete: true }, logging: { delete: true } }
				});
				await this.client.prisma.guildConfig.delete({ where: { id: config.id } });

				this.timeouts.delete(config.id);
			}, getTime());

			this.guildConfig.delete(config.id);
			this.timeouts.set(config.id, { timeout, id: config.id });
		});
	}

	public async scheduleDelete(id: string) {
		let config = this.guildConfig.get(id)!;
		if (!config || this.timeouts.has(id)) return;

		config = await this.update(config.id, { leaveTimestamp: new Date() });

		const getTime = () => {
			const futureDate = config.leaveTimestamp!.getMilliseconds() + 6048e5;
			const now = Date.now();

			return futureDate - now;
		};

		const timeout = setTimeout(async () => {
			await this.client.prisma.guildConfig.update({
				where: { id: config.id },
				data: { automod: { delete: true }, logging: { delete: true } }
			});
			await this.client.prisma.guildConfig.delete({ where: { id: config.id } });
			this.timeouts.delete(config.id);
		}, getTime());

		this.guildConfig.delete(config.id);
		this.timeouts.set(config.id, { timeout, id: config.id });
	}
}
