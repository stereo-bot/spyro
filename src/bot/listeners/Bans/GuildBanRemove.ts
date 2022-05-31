import { checkDate, Listener, ModlogType } from "../../../client";
import { ApplyOptions } from "@sapphire/decorators";
import type { GuildBan } from "discord.js";
import { Events } from "@sapphire/framework";

@ApplyOptions<Listener.Options>({ event: Events.GuildBanRemove })
export default class extends Listener {
	public async run(ban: GuildBan) {
		const auditlogs = await ban.guild
			.fetchAuditLogs({
				type: "MEMBER_BAN_REMOVE",
				limit: 100
			})
			.catch(() => void 0);
		if (!auditlogs) return;

		const auditlog = auditlogs.entries
			.sort((a, b) => b.createdTimestamp - a.createdTimestamp)
			.find((log) => log.target?.id === ban.user.id && checkDate(log.createdTimestamp));
		if (!auditlog) return;

		const moderator = await this.client.utils.fetchUser(auditlog.executor?.id ?? "");
		if (!moderator || moderator.id === this.client.user?.id) return;

		this.client.modLogger.onModEnd({
			guildId: ban.guild.id,
			member: ban.user,
			moderator,
			modlogType: ModlogType.BAN,
			reason: ban.reason ?? "n/a"
		});
	}
}
