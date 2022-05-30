import type { Client } from "../../client";

export const getCaseId = async (client: Client, guildId: string) => {
	const modlogs = await client.prisma.modlog.findMany({ where: { id: { startsWith: guildId } }, select: { id: true } });
	if (!modlogs.length) return `${guildId}-1`;

	const sorted = modlogs.map((data) => Number(data.id.split("-")[1])).sort((a, b) => a - b);
	return `${guildId}-${sorted[sorted.length - 1] + 1}`;
};
