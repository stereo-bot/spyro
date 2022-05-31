import type { GuildMember } from "discord.js";
import type { Client } from "../../client";

export const getCaseId = async (client: Client, guildId: string): Promise<string> => {
	const modlogs = await client.prisma.modlog.findMany({ where: { id: { startsWith: guildId } }, select: { id: true } });
	if (!modlogs.length) return `${guildId}-1`;

	const sorted = modlogs.map((data) => Number(data.id.split("-")[1])).sort((a, b) => a - b);
	return `${guildId}-${sorted[sorted.length - 1] + 1}`;
};

export const checkDate = (date: number): boolean => {
	const now = Date.now();
	const sum = now - date;

	if (sum <= 3e4) return true; // if the gap between the 2 dates are smaller than 30s continue
	return false; // otherwise ignore
};

export const isModeratable = (member: GuildMember, moderator: GuildMember, me: GuildMember): string | null => {
	if (member.id === me.id) return "moderation:errors.moderatable.bot_self";
	if (member.id === moderator.id) return "moderation:errors.moderatable.user_self";

	if (member.guild.ownerId === moderator.id) return null;
	if (member.id === member.guild.ownerId) return "moderation:errors.moderatable.owner";
	if (member.roles.highest.position >= me.roles.highest.position) return "moderation:errors.moderatable.bot_hierarchy";
	if (member.roles.highest.position >= moderator.roles.highest.position) return "moderation:errors.moderatable.user_hierarchy";

	return null;
};
