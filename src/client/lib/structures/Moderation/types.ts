import type { Collection, Guild, GuildChannel, GuildMember, Message } from "discord.js";

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
	vars?: Record<string, any>;
}

export interface AutoModCacheDupData {
	userId: string;
	guildId: string;
	lastMessage: string;
	timeout: NodeJS.Timeout;
}

/**
 * Key for the object is **userId-guildId**
 */
export type AutoModDupCache = Collection<string, AutoModCacheDupData>;

export interface phishingLinksData {
	suspicious: string[];
	guaranteed: string[];
}
