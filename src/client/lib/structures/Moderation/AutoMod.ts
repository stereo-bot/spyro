import { Collection, Invite } from "discord.js";
import type { Client } from "../../../client";
import { INVITE_REGEX } from "./regex";
import type { AutoModDupCache, AutoModResults, GuildMessage } from "./types";

export class AutoMod {
	public dupTextCache: AutoModDupCache = new Collection();

	public constructor(public client: Client) {}

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
			if (dupData.lastMessage === newContent)
				return {
					guild: message.guildId,
					user: message.author.id,
					date: Date.now(),
					key: "AUTOMOD_DUP_TEXT"
				};

			clearTimeout(dupData.timeout);
			const timeout = setTimeout(() => this.dupTextCache.delete(dupId), 6e4);
			this.dupTextCache.set(dupId, {
				...dupData,
				timeout
			});
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
}
