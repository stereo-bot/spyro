import { Collection, Invite } from "discord.js";
import type { Client } from "../../../client";
import { INVITE_REGEX, ZALGO_REGEX } from "./regex";
import type { AutoModDupCache, AutoModResults, AutoModXFilter, AutomodXFilterOptions, GuildMessage, phishingLinksData } from "./types";
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

		const results = await Promise.all([
			this.invite(cleanMessage),
			this.dupText(cleanMessage),
			this.phishingCheck(cleanMessage),
			this.zalgo(message),
			this.spam(message, { amount: 7, duration: 5e3 }),
			this.mention(message, { amount: 7, duration: 5e3 })
		]);
		console.log(results);
	}

	public async invite(message: GuildMessage): Promise<AutoModResults | null> {
		const invites = message.content.match(INVITE_REGEX) ?? [];

		let invite: Invite | null = null;
		for await (const inviteLink of invites) {
			invite = await this.client.fetchInvite(inviteLink).catch(() => null);
			if (invite) break;
		}

		if (!invite) return null;

		return {
			guild: message.guildId,
			user: message.author.id,
			date: Date.now(),
			key: "AUTOMOD_INVITE",
			vars: {
				code: invite.code,
				channel: message.channel.toString(),
				target: invite.guild?.name ?? invite.channel.name
			}
		};
	}

	public dupText(message: GuildMessage): AutoModResults | null {
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
				key: "AUTOMOD_ZALGO"
			};

		return null;
	}

	public spam(message: GuildMessage, options: AutomodXFilterOptions): AutoModResults | null {
		if (this.spamCache.has(`${message.author.id}-${message.guild.id}`)) {
			const { lastMessage, timer, count } = this.spamCache.get(`${message.author.id}-${message.guild.id}`)!;
			const difference = message.createdTimestamp - lastMessage.createdTimestamp;
			let messageCount: number = count;

			if (difference > 25e2) {
				clearTimeout(timer);
				this.spamCache.set(`${message.author.id}-${message.guild.id}`, {
					count: 1,
					lastMessage: message,
					timer: setTimeout(() => this.spamCache.delete(`${message.author.id}-${message.guild.id}`), options.duration)
				});
			} else {
				++messageCount;
				if (messageCount >= options.amount) {
					this.spamCache.set(`${message.author.id}-${message.guild.id}`, {
						lastMessage: message,
						count: 1,
						timer
					});
					return {
						guild: message.guildId,
						user: message.author.id,
						date: Date.now(),
						key: "AUTOMOD_SPAM",
						vars: options
					};
				}
				this.spamCache.set(`${message.author.id}-${message.guild.id}`, {
					lastMessage: message,
					count: messageCount,
					timer
				});
			}
		} else {
			const fn = setTimeout(() => this.spamCache.delete(`${message.author.id}-${message.guild.id}`), options.duration);
			this.spamCache.set(`${message.author.id}-${message.guild.id}`, {
				count: 1,
				lastMessage: message,
				timer: fn
			});
		}

		return null;
	}

	public mention(message: GuildMessage, options: AutomodXFilterOptions): AutoModResults | null {
		if (this.mentionCache.has(`${message.author.id}-${message.guild.id}`)) {
			const { lastMessage, timer, count } = this.mentionCache.get(`${message.author.id}-${message.guild.id}`)!;
			const difference = message.createdTimestamp - lastMessage.createdTimestamp;
			let mentionCount: number = count;

			if (difference > 25e2) {
				clearTimeout(timer);
				this.mentionCache.set(`${message.author.id}-${message.guild.id}`, {
					count: 1,
					lastMessage: message,
					timer: setTimeout(() => this.mentionCache.delete(`${message.author.id}-${message.guild.id}`), options.duration)
				});
			} else {
				mentionCount += message.mentions.members?.filter((m) => !m.user.bot && m.id !== message.author.id).size ?? 0;

				if (mentionCount >= options.amount) {
					this.mentionCache.set(`${message.author.id}-${message.guild.id}`, {
						lastMessage: message,
						count: 1,
						timer
					});
					return {
						guild: message.guildId,
						user: message.author.id,
						date: Date.now(),
						key: "AUTOMOD_MENTION",
						vars: options
					};
				}
				this.mentionCache.set(`${message.author.id}-${message.guild.id}`, {
					lastMessage: message,
					count: mentionCount,
					timer
				});
			}
		} else {
			const fn = setTimeout(() => this.mentionCache.delete(`${message.author.id}-${message.guild.id}`), options.duration);

			this.mentionCache.set(`${message.author.id}-${message.guild.id}`, {
				count: message.mentions.members?.filter((m) => !m.user.bot && m.id !== message.author.id).size ?? 0,
				lastMessage: message,
				timer: fn
			});
		}

		return null;
	}

	private unZalgo(str: string) {
		return clean(str);
	}
}
