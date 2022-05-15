import type { Guild, GuildChannel, GuildMember, Message } from "discord.js";

export type GuildMessage = Message & {
	guild: Guild;
	guildId: string;
	member: GuildMember;
	channel: GuildChannel;
};

export interface AutoModResults {
	guild: string;
	user: string;
	date: number;
	key: string;
	vars: Record<string, any>;
}
