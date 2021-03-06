import { Collection, Invite } from "discord.js";
import type { Client } from "../../../client";
import { INVITE_REGEX, ZALGO_REGEX } from "./regex";
import type {
	AutoModBadwordsOptions,
	AutoModDupCache,
	AutomodInviteOptions,
	AutoModModuleFunctionResult,
	AutoModResults,
	AutoModXFilter,
	AutomodXFilterOptions,
	GuildMessage,
	phishingLinksData
} from "./types";
import { clean } from "unzalgo";

export class AutoMod {
	public dupTextCache: AutoModDupCache = new Collection();
	public spamCache = new Collection<string, AutoModXFilter>();
	public mentionCache = new Collection<string, AutoModXFilter>();

	public phishing: phishingLinksData = {
		suspicious: [],
		guaranteed: []
	};

	public constructor(public client: Client) {}

	public async run(message: GuildMessage) {
		const cleanMessage = message;
		cleanMessage.content = this.unZalgo(message.content);

		if (message.author.bot || message.webhookId) return;

		const config = this.client.configManager.get(message.guildId);
		if (!config.automod.moduleEnabled || !this.shouldAdd(message, config.automod.globalWhitelist)) return;

		const badwordsConfig = { blacklisted: config.automod.BadwordsBlockedList, whitelisted: config.automod.BadwordsAllowedList };
		const spamConfig = { amount: config.automod.SpamAmount, duration: config.automod.SpamDuration * 1e3 };
		const mentionConfig = { amount: config.automod.MassMentionAmount, duration: config.automod.MassMentionDuration * 1e3 };
		const duptextConfig = { amount: config.automod.DupTextAmount, duration: config.automod.DupTextDuration * 1e3 };
		const inviteConfig = { whitelistedCodes: config.automod.inviteCodeWhitelist };

		const automodModules: AutoModModuleFunctionResult[] = [];
		if (config.automod.inviteEnabled && this.shouldAdd(message, config.automod.inviteWhitelist))
			automodModules.push(this.invite(cleanMessage, inviteConfig));
		if (config.automod.DupTextEnabled && this.shouldAdd(message, config.automod.DupTextWhitelist))
			automodModules.push(this.dupText(cleanMessage, duptextConfig));
		if (config.automod.PhishingEnabled && this.shouldAdd(message, config.automod.PhishingWhitelist))
			automodModules.push(this.phishingCheck(cleanMessage));
		if (config.automod.BadwordsEnabled && this.shouldAdd(message, config.automod.BadwordsWhitelist))
			automodModules.push(this.badwords(cleanMessage, badwordsConfig));
		if (config.automod.SpamEnabled && this.shouldAdd(message, config.automod.SpamWhitelist)) automodModules.push(this.spam(message, spamConfig));
		if (config.automod.MassMentionEnabled && this.shouldAdd(message, config.automod.MassMentionWhitelist))
			automodModules.push(this.mention(message, mentionConfig));
		if (config.automod.ZalgoEnabled && this.shouldAdd(message, config.automod.ZalgoWhitelist)) automodModules.push(this.zalgo(message));

		const results = await Promise.all(automodModules);
		this.client.modaction.handleResults(results.filter((res) => res !== null) as AutoModResults[]);
	}

	public async invite(message: GuildMessage, options: AutomodInviteOptions): Promise<AutoModResults | null> {
		const invites = message.content.match(INVITE_REGEX) ?? [];

		let invite: Invite | null = null;
		for await (const inviteLink of invites) {
			invite = await this.client.fetchInvite(inviteLink).catch(() => null);
			if (invite && invite.guild?.id !== message.guildId && !options.whitelistedCodes.includes(invite.code)) break;
		}

		if (!invite) return null;

		return {
			guild: message.guildId,
			user: message.author.id,
			date: Date.now(),
			key: "AUTOMOD_INVITE",
			message,
			vars: {
				code: invite.code,
				channel: message.channel.toString(),
				target: invite.guild?.name ?? invite.channel.name
			}
		};
	}

	public dupText(message: GuildMessage, options: AutomodXFilterOptions): AutoModResults | null {
		const newContent = message.content.toLowerCase();
		const dupId = `${message.author.id}-${message.guildId}`;

		const dupData = this.dupTextCache.get(dupId);
		if (dupData) {
			clearTimeout(dupData.timeout);
			const timeout = setTimeout(() => this.dupTextCache.delete(dupId), 6e4);
			this.dupTextCache.set(dupId, {
				...dupData,
				timeout,
				lastMessage: newContent
			});

			if (dupData.lastMessage === newContent)
				return {
					guild: message.guildId,
					user: message.author.id,
					date: Date.now(),
					message,
					key: "AUTOMOD_DUP_TEXT"
				};
		} else {
			const timeout = setTimeout(() => this.dupTextCache.delete(dupId), 6e4);
			this.dupTextCache.set(dupId, {
				guildId: message.guildId,
				userId: message.author.id,
				lastMessage: newContent,
				timeout
			});
		}

		return null;
	}

	public phishingCheck(message: GuildMessage): AutoModResults | null {
		const content = message.content.toLowerCase();
		if (this.phishing.guaranteed.some((str) => content.includes(str)) || this.phishing.suspicious.some((str) => content.includes(str)))
			return {
				guild: message.guildId,
				user: message.author.id,
				date: Date.now(),
				message,
				key: "AUTOMOD_PHISHING"
			};

		return null;
	}

	public zalgo(message: GuildMessage): AutoModResults | null {
		if (ZALGO_REGEX.test(encodeURIComponent(message.content)))
			return {
				guild: message.guildId,
				user: message.author.id,
				date: Date.now(),
				message,
				key: "AUTOMOD_ZALGO"
			};

		return null;
	}

	public spam(message: GuildMessage, options: AutomodXFilterOptions): AutoModResults | null {
		if (this.spamCache.has(`${message.author.id}-${message.guild.id}`)) {
			const { lastMessage, timer, count, messages } = this.spamCache.get(`${message.author.id}-${message.guild.id}`)!;
			const difference = message.createdTimestamp - lastMessage.createdTimestamp;
			let messageCount: number = count;

			if (difference > 25e2) {
				clearTimeout(timer);
				this.spamCache.set(`${message.author.id}-${message.guild.id}`, {
					count: 1,
					lastMessage: message,
					messages: [...messages, message],
					timer: setTimeout(() => this.spamCache.delete(`${message.author.id}-${message.guild.id}`), options.duration)
				});
			} else {
				++messageCount;
				if (messageCount >= options.amount) {
					this.spamCache.set(`${message.author.id}-${message.guild.id}`, {
						lastMessage: message,
						messages: [],
						count: 1,
						timer
					});
					return {
						guild: message.guildId,
						user: message.author.id,
						date: Date.now(),
						key: "AUTOMOD_SPAM",
						message,
						vars: { ...options, messages: [...messages, message] }
					};
				}

				this.spamCache.set(`${message.author.id}-${message.guild.id}`, {
					lastMessage: message,
					messages: [...messages, message],
					count: messageCount,
					timer
				});
			}
		} else {
			const fn = setTimeout(() => this.spamCache.delete(`${message.author.id}-${message.guild.id}`), options.duration);
			this.spamCache.set(`${message.author.id}-${message.guild.id}`, {
				count: 1,
				lastMessage: message,
				messages: [],
				timer: fn
			});
		}

		return null;
	}

	public mention(message: GuildMessage, options: AutomodXFilterOptions): AutoModResults | null {
		if (this.mentionCache.has(`${message.author.id}-${message.guild.id}`)) {
			const { lastMessage, timer, count, messages } = this.mentionCache.get(`${message.author.id}-${message.guild.id}`)!;
			const difference = message.createdTimestamp - lastMessage.createdTimestamp;
			let mentionCount: number = count;

			if (difference > 25e2) {
				clearTimeout(timer);
				this.mentionCache.set(`${message.author.id}-${message.guild.id}`, {
					count: 1,
					lastMessage: message,
					messages: [...messages, message],
					timer: setTimeout(() => this.mentionCache.delete(`${message.author.id}-${message.guild.id}`), options.duration)
				});
			} else {
				mentionCount += message.mentions.members?.filter((m) => !m.user.bot && m.id !== message.author.id).size ?? 0;

				if (mentionCount >= options.amount) {
					this.mentionCache.set(`${message.author.id}-${message.guild.id}`, {
						lastMessage: message,
						messages: [],
						count: 1,
						timer
					});
					return {
						guild: message.guildId,
						user: message.author.id,
						date: Date.now(),
						key: "AUTOMOD_MENTION",
						message,
						vars: { ...options, messages }
					};
				}
				this.mentionCache.set(`${message.author.id}-${message.guild.id}`, {
					lastMessage: message,
					count: mentionCount,
					messages: [...messages, message],
					timer
				});
			}
		} else {
			const fn = setTimeout(() => this.mentionCache.delete(`${message.author.id}-${message.guild.id}`), options.duration);

			this.mentionCache.set(`${message.author.id}-${message.guild.id}`, {
				count: message.mentions.members?.filter((m) => !m.user.bot && m.id !== message.author.id).size ?? 0,
				lastMessage: message,
				messages: [],
				timer: fn
			});
		}

		return null;
	}

	public badwords(message: GuildMessage, options: AutoModBadwordsOptions): AutoModResults | null {
		const content = this.client.utils.cleanText(message.content.toLowerCase());
		if (!content) return null;

		const words = message.content
			.split(/\s+/)
			.map((word) =>
				options.blacklisted.some((str) => word.includes(str.toLowerCase())) &&
				!options.whitelisted.some((str) => word.includes(str.toLowerCase()))
					? word
					: null
			)
			.filter((w) => w !== null)
			.join(", ");

		if (!words) return null;

		return {
			guild: message.guildId,
			user: message.author.id,
			date: Date.now(),
			key: "AUTOMOD_BAD_WORDS",
			message,
			vars: {
				words
			}
		};
	}

	private unZalgo(str: string) {
		return clean(str);
	}

	private shouldAdd(message: GuildMessage, whitelist: string[]): boolean {
		const channel = `CHANNEL-${message.channelId}`;
		const user = `ROLE-${message.author.id}`;
		const roles = message.member.roles.cache.map((role) => `ROLE-${role.id}`);

		if (whitelist.includes(channel) || whitelist.includes(user)) return false;
		if (roles.some((role) => whitelist.includes(role))) return false;
		if (message.member.id === message.guild.ownerId) return false;
		if (message.member.permissions.has("ADMINISTRATOR")) return false;

		return true;
	}
}
