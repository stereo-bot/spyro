import type { Client } from "../../client";

export const getCaseId = async (client: Client, guildId: string) => {
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
