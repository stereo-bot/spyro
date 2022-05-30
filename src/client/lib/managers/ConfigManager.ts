import { Collection } from "discord.js";
import type { Client } from "../..";
import type { FullGuildConfig } from "../../types";

const getMockConfig = (id: string): FullGuildConfig => ({
	automod: {
		guildId: id,
		moduleEnabled: false,
		MuteDuration: 6e2,
		BanDuration: 864e2,
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
	leaveTimestamp: null,
	locale: "en"
});

interface ConfigTimeout {
	id: string;
	timeout: NodeJS.Timeout;
}

export class ConfigManager {
	public guildConfig = new Collection<string, FullGuildConfig>();
	public timeouts = new Collection<string, ConfigTimeout>();

	public constructor(public client: Client) {}

	public async loadAll() {
		const configs = (await this.client.prisma.guildConfig.findMany({
			select: { automod: true, logging: true, id: true }
		})) as FullGuildConfig[];
		const configsCollection = new Collection<string, FullGuildConfig>();
		configs.forEach((c) => configsCollection.set(c.id, c));

		const [active, inactive] = configsCollection.partition((config) => this.client.guilds.cache.has(config.id));
		active.forEach((config) => this.guildConfig.set(config.id, config));
		inactive.forEach((config) => this.scheduleDelete(config.id));

		const [, newGuilds] = this.client.guilds.cache.partition((g) => this.guildConfig.has(g.id));
		newGuilds.forEach(async (g) => {
			const guildConfig = await this.client.prisma.guildConfig.create({
				data: { id: g.id, automod: { create: {} }, logging: { create: {} } },
				select: { automod: true, logging: true, id: true }
			});
			this.guildConfig.set(g.id, guildConfig as unknown as FullGuildConfig);
		});
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

		const timeout = this.timeouts.get(guildId);
		if (timeout) {
			clearTimeout(timeout.timeout);
			this.timeouts.delete(guildId);
		}
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

	public async scheduleDelete(id: string) {
		let config = this.guildConfig.get(id)!;

		if (!config || this.timeouts.has(id)) return;
		if (!config.leaveTimestamp) config = await this.update(config.id, { leaveTimestamp: new Date() });

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
