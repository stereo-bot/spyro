import type { AutoModConfig, GuildConfig, LoggingConfig } from "@prisma/client";

export type FullGuildConfig = GuildConfig & AutoModConfig & LoggingConfig;
