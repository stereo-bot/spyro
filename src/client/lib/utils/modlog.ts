import type { Client } from "../../client";

export const getCaseId = async (client: Client, guildId: string) => {
	const modlogs = await client.prisma.modlog.findMany({ where: { guildId }, select: { case: true } });
	const sorted = modlogs.sort((a, b) => a.case - b.case);

	return sorted[sorted.length].case + 1;
};
