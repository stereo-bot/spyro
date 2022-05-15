import type { Invite } from "discord.js";
import type { Client } from "../../../client";
import type { AutoModResults, GuildMessage } from "./types";

export class AutoMod {
	public constructor(public client: Client) {}

	public async invite(message: GuildMessage): Promise<AutoModResults | null> {
		const regex = /discord(?:(?:app)?\.com\/invite|\.gg(?:\/invite)?)\/([\w-]{2,255})/gi;
		const invites = message.content.match(regex) ?? [];

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
}