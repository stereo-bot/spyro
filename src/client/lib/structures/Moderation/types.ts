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
	message: GuildMessage;
}

export interface AutoModCacheDupData {
	userId: string;
	guildId: string;
	lastMessage: string;
	timeout: NodeJS.Timeout;
}

export interface AutoModXFilter {
	count: number;
	lastMessage: Message;
	timer: NodeJS.Timeout;
}

export interface AutomodInviteOptions {
	whitelistedCodes: string[];
}

export interface AutomodXFilterOptions {
	amount: number;
	duration: number;
}

export interface AutoModBadwordsOptions {
	whitelisted: string[];
	blacklisted: string[];
}

/**
 * Key for the object is **userId-guildId**
 */
export type AutoModDupCache = Collection<string, AutoModCacheDupData>;

export interface phishingLinksData {
	suspicious: string[];
	guaranteed: string[];
}

export type AutoModModuleFunctionResult = Promise<AutoModResults | null> | (AutoModResults | null);
