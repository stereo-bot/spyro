import { checkDate, getCaseId, Listener, Modlog, ModlogType } from "../../../client";
import { ApplyOptions } from "@sapphire/decorators";
import type { GuildBan } from "discord.js";
import { Events } from "@sapphire/framework";

@ApplyOptions<Listener.Options>({ event: Events.GuildBanAdd })
export default class extends Listener {
	public async run(ban: GuildBan) {
		const config = this.client.configManager.get(ban.guild.id);
		const auditlogs = await ban.guild
			.fetchAuditLogs({
				type: "MEMBER_BAN_ADD",
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

		const modlog = new Modlog(this.client);
		const id = await getCaseId(this.client, ban.guild.id);
		const [, caseId] = id.split("-");
		await modlog.create({
			id,
			reason: ban.reason ?? this.client.localeManager.translate(config.locale, "logging:mod.no_reason", { id: caseId }),
			date: new Date(auditlog.createdTimestamp),
			member: ban.user.id,
			moderator: moderator.id,
			modlogType: ModlogType.BAN,
			expire: null
		});

		this.client.modLogger.onModAdd(modlog);
	}
}
