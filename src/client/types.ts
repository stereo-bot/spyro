import type { AutoModConfig, GuildConfig, LoggingConfig } from "@prisma/client";

export type FullGuildConfig = GuildConfig & {
	automod: AutoModConfig;
	logging: LoggingConfig;
};

export enum ModlogType {
	WARN,
	MUTE,
	KICK,
	SOFTBAN,
	BAN
}
