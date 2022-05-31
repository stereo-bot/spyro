import { getCaseId, Listener, Modlog, ModlogType } from "../../../client";
import { ApplyOptions } from "@sapphire/decorators";
import type { AuditLogChange, GuildAuditLogsEntry, GuildMember } from "discord.js";
import { Events } from "@sapphire/framework";

@ApplyOptions<Listener.Options>({ event: Events.GuildMemberUpdate })
export default class extends Listener {
	public async run(oldMember: GuildMember, newMember: GuildMember) {
		const config = this.client.configManager.get(newMember.guild.id);

		if (oldMember.isCommunicationDisabled() && !newMember.isCommunicationDisabled()) {
			const auditlogs = await oldMember.guild.fetchAuditLogs({ type: "MEMBER_UPDATE", limit: 100 }).catch(() => void 0);
			if (!auditlogs) return;

			const filter = (log: GuildAuditLogsEntry<"MEMBER_UPDATE", "MEMBER_UPDATE", "UPDATE", "USER">) => {
				if (log.target?.id !== newMember.id) return false;

				const change = log.changes?.find(
					(change) => change.key === "communication_disabled_until" && typeof change.old === "string" && typeof change.new === "undefined"
				);
				if (!change) return false;

				return true;
			};
			const auditlog = auditlogs?.entries.sort((a, b) => b.createdTimestamp - a.createdTimestamp).find(filter);
			if (!auditlog) return;

			const moderator = await this.client.utils.fetchUser(auditlog.executor?.id ?? "");
			if (!moderator) return;

			this.client.modLogger.onModEnd({
				moderator,
				member: newMember.user,
				guildId: newMember.guild.id,
				reason: auditlog.reason ?? "n/a",
				modlogType: ModlogType.MUTE
			});
		}

		if (!oldMember.isCommunicationDisabled() && newMember.isCommunicationDisabled()) {
			const auditlogs = await oldMember.guild.fetchAuditLogs({ type: "MEMBER_UPDATE", limit: 100 }).catch(() => void 0);
			if (!auditlogs) return;

			let change: AuditLogChange | undefined;
			const filter = (log: GuildAuditLogsEntry<"MEMBER_UPDATE", "MEMBER_UPDATE", "UPDATE", "USER">) => {
				if (log.target?.id !== newMember.id) return false;

				const changes = log.changes?.filter(
					(change) => change.key === "communication_disabled_until" && typeof change.new === "string" && typeof change.old === "undefined"
				);
				if (!changes?.length) return false;
				change = changes[changes.length - 1];

				return true;
			};
			const auditlog = auditlogs?.entries.find(filter);
			if (!auditlog || !change) return;

			const moderator = await this.client.utils.fetchUser(auditlog.executor?.id ?? "");
			if (!moderator) return;

			const modlog = new Modlog(this.client);
			const id = await getCaseId(this.client, newMember.guild.id);
			const caseId = id.split("-")[1];
			await modlog.create({
				date: new Date(),
				expire: new Date(change.new as string),
				id,
				member: newMember.id,
				moderator: moderator.id,
				modlogType: ModlogType.MUTE,
				reason: auditlog.reason ?? this.client.localeManager.translate(config.locale, "logging:mod.no_reason", { id: caseId })
			});
			this.client.modLogger.onModAdd(modlog);
		}
	}
}
