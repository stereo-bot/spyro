import { Collection, Invite } from "discord.js";
import type { Client } from "../../../client";
import { INVITE_REGEX } from "./regex";
import type { AutoModDupCache, AutoModResults, GuildMessage, phishingLinksData } from "./types";

export class AutoMod {
	public dupTextCache: AutoModDupCache = new Collection();
	public phishing: phishingLinksData = {
		suspicious: [],
		guaranteed: []
	};

	public constructor(public client: Client) {}

	public async run(message: GuildMessage) {
		const results = await Promise.all([this.invite(message), this.dupText(message), this.phishingCheck(message)]);
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
}
