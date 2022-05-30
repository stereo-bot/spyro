import { ModerationAction } from "@prisma/client";
import type { Client } from "../../../client";
import type { AutoModResults } from "./types";
import { Modlog } from "./Modlog";
import { getCaseId } from "../../utils";
import ms from "ms";
import { ModlogType } from "../../../types";

export class ModAction {
	public constructor(public client: Client) {}

	public handleResults(results: AutoModResults[]) {
		results.forEach(async (res) => {
			const config = this.getAutomodConfig(res);
			const guildConfig = this.client.configManager.get(res.guild);

			if (config.action !== ModerationAction.VERBAL) {
				const id = await getCaseId(this.client, res.guild);
				const date = new Date();
				const modlogType = ModlogType[config.action];

				let expire: Date | null = null;
				let duration = 0;

				const addExpire = modlogType === ModlogType.MUTE || modlogType === ModlogType.BAN;
				if (addExpire) {
					expire = new Date(date.getMilliseconds() + guildConfig.automod[modlogType === ModlogType.MUTE ? "MuteDuration" : "BanDuration"]);
					duration = guildConfig.automod[modlogType === ModlogType.MUTE ? "MuteDuration" : "BanDuration"];
				}

				const data = {
					date,
					expire,
					modlogType,
					id,
					member: res.user,
					moderator: this.client.user!.id,
					reason: config.reason
				};

				const modlog = new Modlog(this.client);
				await modlog.create(data);

				switch (modlogType) {
					case ModlogType.WARN:
						await this.warn(modlog);
						break;
					case ModlogType.MUTE:
						await this.mute(modlog, duration);
						break;
					default:
						break;
				}
			}
		});
	}

	public async warn(modlog: Modlog) {
		const userMessage = this.t(modlog.locale, "moderation:user_dm.warn", { guild: modlog.guild.name, reason: modlog.reason });
		await modlog.member.send(userMessage).catch(() => void 0); // catch: User closed his DMs or is no longer in the guild.

		this.client.modLogger.onModAdd(modlog);
	}

	public async mute(modlog: Modlog, duration: number) {
		const userMessage = this.t(modlog.locale, "moderation:user_dm.mute", {
			guild: modlog.guild.name,
			reason: modlog.reason,
			duration: ms(duration)
		});

		const member = await this.client.utils.fetchMember(modlog.member.id, modlog.guild);
		if (!member) throw new Error("GUILD_MEMBER_NOT_FOUND");
		if (member.isCommunicationDisabled()) throw new Error("GUILD_MEMBER_MUTED");

		await modlog.member.send(userMessage).catch(() => void 0); // catch: User closed his DMs or is no longer in the guild.
		await member.timeout(duration, modlog.reason).catch(() => void 0);

		this.client.modLogger.onModAdd(modlog);
	}

	private get t() {
		return this.client.localeManager.translate.bind(this.client.localeManager);
	}

	private getAutomodConfig(data: AutoModResults) {
		const config = this.client.configManager.get(data.guild);

		let action: ModerationAction;
		let deleteMessage: boolean;
		let reason: string;

		switch (data.key) {
			case "AUTOMOD_INVITE":
				action = config.automod.inviteAction;
				deleteMessage = config.automod.inviteDelete;
				reason = this.t(config.locale, "moderation.automod_reasons.invite", data.vars);
				break;
			case "AUTOMOD_DUP_TEXT":
				action = config.automod.DupTextAction;
				deleteMessage = config.automod.DupTextDelete;
				reason = this.t(config.locale, "moderation.automod_reasons.duplicate", data.vars);
				break;
			case "AUTOMOD_PHISHING":
				action = config.automod.PhishingAction;
				deleteMessage = config.automod.PhishingDelete;
				reason = this.t(config.locale, "moderation.automod_reasons.phishing", data.vars);
				break;
			case "AUTOMOD_ZALGO":
				action = config.automod.ZalgoAction;
				deleteMessage = config.automod.ZalgoDelete;
				reason = this.t(config.locale, "moderation.automod_reasons.zalgo", data.vars);
				break;
			case "AUTOMOD_SPAM":
				{
					action = config.automod.SpamAction;
					deleteMessage = config.automod.SpamDelete;

					const vars = { ...data.vars, duration: ms(data.vars?.duration ?? 0) };
					reason = this.t(config.locale, "moderation.automod_reasons.spam", vars);
				}
				break;
			case "AUTOMOD_MENTION":
				{
					action = config.automod.MassMentionAction;
					deleteMessage = config.automod.MassMentionDelete;

					const vars = { ...data.vars, duration: ms(data.vars?.duration ?? 0) };
					reason = this.t(config.locale, "moderation.automod_reasons.mention", vars);
				}
				break;
			default:
				action = ModerationAction.VERBAL;
				deleteMessage = true;
				reason = this.t(config.locale, "logging:mod.no_reason");
				break;
		}

		return {
			action,
			reason,
			deleteMessage
		};
	}
}
