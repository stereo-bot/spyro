import { checkDate, getCaseId, Listener, Modlog, ModlogType } from "../../../client";
import { ApplyOptions } from "@sapphire/decorators";
import type { GuildMember } from "discord.js";
import { Events } from "@sapphire/framework";

@ApplyOptions<Listener.Options>({ event: Events.GuildMemberRemove })
export default class extends Listener {
	public async run(member: GuildMember) {
		const config = this.client.configManager.get(member.guild.id);
		const auditlogs = await member.guild
			.fetchAuditLogs({
				type: "MEMBER_KICK",
				limit: 10
			})
			.catch(() => void 0);
		if (!auditlogs) return;

		const auditlog = auditlogs.entries
			.sort((a, b) => b.createdTimestamp - a.createdTimestamp)
			.find((log) => log.target?.id === member.user.id && checkDate(log.createdTimestamp));
		if (!auditlog) return;

		const moderator = await this.client.utils.fetchUser(auditlog.executor?.id ?? "");
		if (!moderator || moderator.id === this.client.user?.id) return;

		const modlog = new Modlog(this.client);
		const id = await getCaseId(this.client, member.guild.id);
		const caseId = id.split("-")[1];
		await modlog.create({
			id,
			expire: null,
			modlogType: ModlogType.KICK,
			date: new Date(auditlog.createdTimestamp),
			member: member.id,
			moderator: moderator.id,
			reason: auditlog.reason ?? this.client.localeManager.translate(config.locale, "logging:mod.no_reason", { id: caseId })
		});

		this.client.modLogger.onModAdd(modlog);
	}
}
