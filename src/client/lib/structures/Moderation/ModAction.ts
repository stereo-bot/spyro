import { ModerationAction } from "@prisma/client";
import type { Client } from "../../../client";
import type { AutoModResults } from "./types";
import { Modlog } from "./Modlog";
import { getCaseId } from "../../utils";
import ms from "ms";
import { ModlogType } from "../../../types";
import type { GuildMessage } from "./";
import type { GuildMember } from "discord.js";
import moment from "moment";

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
					duration = guildConfig.automod[modlogType === ModlogType.MUTE ? "MuteDuration" : "BanDuration"] * 1e3;
					expire = moment(date).add(duration).toDate();
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
					case ModlogType.KICK:
						await this.kick(modlog);
						break;
					case ModlogType.SOFTBAN:
						await this.softban(modlog);
						break;
					case ModlogType.BAN:
						await this.ban(modlog);
						break;
					default:
						break;
				}
			}

			try {
				await res.message.reply({ content: config.response, allowedMentions: { repliedUser: true } }); // Respond to violation in chat
			} catch (err) {
				try {
					await res.message.channel.send({ content: `<@${res.user}>, ${config.response}`, allowedMentions: { users: [res.user] } }); // Try sending it in the channel instead
				} catch (e) {} // ignore the error
			}

			if (config.deleteMessage) {
				if (res.vars?.messages) {
					const messages = res.vars?.messages as GuildMessage[];
					res.message.channel.bulkDelete(messages).catch(() => void 0); // delete spam/mention messages
				} else await res.message.delete().catch(() => void 0); // delete normal message
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
		if (!member.moderatable) {
			await modlog.delete();
			throw new Error("MEMBER_NOT_MODERATABLE"); // We cannot issue a punishment for an unpunishable user
		}

		await modlog.member.send(userMessage).catch(() => void 0); // catch: User closed his DMs or is no longer in the guild.

		try {
			await member.timeout(duration, modlog.reason);
			this.client.modLogger.onModAdd(modlog);
		} catch (err) {
			this.client.logger.error(`[ModAction#mute()]: Error occurred while timing out a user`, err);

			await modlog.delete();
			throw new Error("MUTE_ERROR");
		}
	}

	public async kick(modlog: Modlog) {
		const userMessage = this.t(modlog.locale, "moderation:user_dm.kick", {
			guild: modlog.guild.name,
			reason: modlog.reason
		});

		const member = await this.client.utils.fetchMember(modlog.member.id, modlog.guild);
		if (!member) throw new Error("GUILD_MEMBER_NOT_FOUND");
		if (!member.kickable) {
			await modlog.delete();
			throw new Error("MEMBER_NOT_MODERATABLE"); // We cannot issue a punishment for an unpunishable user
		}

		await modlog.member.send(userMessage).catch(() => void 0); // catch: User closed his DMs or is no longer in the guild.

		try {
			await member.kick(modlog.reason);
			this.client.modLogger.onModAdd(modlog);
		} catch (err) {
			this.client.logger.error(`[ModAction#kick()]: Error occurred while kicking a user`, err);

			await modlog.delete();
			throw new Error("KICK_ERROR");
		}
	}

	public async softban(modlog: Modlog) {
		const userMessage = this.t(modlog.locale, "moderation:user_dm.softban", {
			guild: modlog.guild.name,
			reason: modlog.reason
		});

		const member = await this.client.utils.fetchMember(modlog.member.id, modlog.guild);
		if (!member) throw new Error("GUILD_MEMBER_NOT_FOUND");
		if (!member.bannable) {
			await modlog.delete();
			throw new Error("MEMBER_NOT_MODERATABLE"); // We cannot issue a punishment for an unpunishable user
		}

		await modlog.member.send(userMessage).catch(() => void 0); // catch: User closed his DMs or is no longer in the guild.

		try {
			await member.ban({ reason: modlog.reason, days: 7 });
			await modlog.guild.bans.remove(modlog.member);
			this.client.modLogger.onModAdd(modlog);
		} catch (err) {
			this.client.logger.error(`[ModAction#softban()]: Error occurred while banning/unbanning a user`, err);

			await modlog.delete();
			throw new Error("SOFTBAN_ERROR");
		}
	}

	public async ban(modlog: Modlog) {
		const userMessage = this.t(modlog.locale, "moderation:user_dm.softban", {
			guild: modlog.guild.name,
			reason: modlog.reason
		});

		const member = await this.client.utils.fetchMember(modlog.member.id, modlog.guild);
		if (!member) throw new Error("GUILD_MEMBER_NOT_FOUND");
		if (!member.bannable) {
			await modlog.delete();
			throw new Error("MEMBER_NOT_MODERATABLE"); // We cannot issue a punishment for an unpunishable user
		}

		await modlog.member.send(userMessage).catch(() => void 0); // catch: User closed his DMs or is no longer in the guild.

		try {
			await member.ban({ reason: modlog.reason });
			this.client.modLogger.onModAdd(modlog);
		} catch (err) {
			this.client.logger.error(`[ModAction#ban()]: Error occurred while banning a user`, err);

			await modlog.delete();
			throw new Error("BAN_ERROR");
		}
	}

	public async unban(modlog: Modlog) {
		if (!modlog.guild.me?.permissions.has("BAN_MEMBERS")) {
			await modlog.delete();
			throw new Error("NO_BAN_PERMISSIONS");
		}

		try {
			await modlog.guild.bans.remove(modlog.member, modlog.reason);
			this.client.modLogger.onModAdd(modlog);
		} catch (err) {
			this.client.logger.error(`[ModAction#unban()]: Error occurred while unbanning a user`, err);

			await modlog.delete();
			throw new Error("UNBAN_ERROR");
		}
	}

	public async unmute(member: GuildMember) {
		if (!member.moderatable) {
			throw new Error("MEMBER_NOT_MODERATABLE"); // We cannot issue an unmute for an unmanagable user
		}

		try {
			await member.disableCommunicationUntil(null);
		} catch (err) {
			this.client.logger.error(`[ModAction#unmute()]: Error occurred while unmuting a user`, err);
		}
	}

	/**
	 * @param id The caseId of the modlog, don't provide one if you want to delete all cases
	 */
	public async removelogs(guildId: string, memberId: string, id?: string) {
		if (id) {
			const _id = `${guildId}-${id}`;
			const _modlog = await this.client.prisma.modlog.findFirst({ where: { id: _id } });
			if (!_modlog) return;

			const modlog = new Modlog(this.client, _modlog);

			try {
				await modlog.delete();
			} catch (err) {
				this.client.logger.fatal(`[ModAction#removelogs()]: Error occurred while removing a modlog`, err);
			}

			return;
		}

		await this.client.prisma.modlog.deleteMany({ where: { member: memberId } }).catch(() => void 0);
	}

	private get t() {
		return this.client.localeManager.translate.bind(this.client.localeManager);
	}

	private getAutomodConfig(data: AutoModResults) {
		const config = this.client.configManager.get(data.guild);

		let action: ModerationAction;
		let deleteMessage: boolean;
		let reason: string;
		let response: string;

		switch (data.key) {
			case "AUTOMOD_INVITE":
				action = config.automod.inviteAction;
				deleteMessage = config.automod.inviteDelete;
				reason = this.t(config.locale, "moderation:automod_reasons.invite", data.vars);
				response = this.t(config.locale, "moderation:automod_responses.invite");
				break;
			case "AUTOMOD_DUP_TEXT":
				action = config.automod.DupTextAction;
				deleteMessage = config.automod.DupTextDelete;
				reason = this.t(config.locale, "moderation:automod_reasons.duplicate", data.vars);
				response = this.t(config.locale, "moderation:automod_responses.duplicate");
				break;
			case "AUTOMOD_PHISHING":
				action = config.automod.PhishingAction;
				deleteMessage = config.automod.PhishingDelete;
				reason = this.t(config.locale, "moderation:automod_reasons.phishing", data.vars);
				response = this.t(config.locale, "moderation:automod_responses.phishing");
				break;
			case "AUTOMOD_ZALGO":
				action = config.automod.ZalgoAction;
				deleteMessage = config.automod.ZalgoDelete;
				reason = this.t(config.locale, "moderation:automod_reasons.zalgo", data.vars);
				response = this.t(config.locale, "moderation:automod_responses.zalgo");
				break;
			case "AUTOMOD_SPAM":
				{
					action = config.automod.SpamAction;
					deleteMessage = config.automod.SpamDelete;

					const vars = { ...data.vars, duration: ms(data.vars?.duration ?? 0) };
					reason = this.t(config.locale, "moderation:automod_reasons.spam", vars);
					response = this.t(config.locale, "moderation:automod_responses.spam");
				}
				break;
			case "AUTOMOD_MENTION":
				{
					action = config.automod.MassMentionAction;
					deleteMessage = config.automod.MassMentionDelete;

					const vars = { ...data.vars, duration: ms(data.vars?.duration ?? 0) };
					reason = this.t(config.locale, "moderation:automod_reasons.mention", vars);
					response = this.t(config.locale, "moderation:automod_responses.mention");
				}
				break;
			default:
				action = ModerationAction.VERBAL;
				deleteMessage = true;
				reason = this.t(config.locale, "logging:mod.no_reason");
				response = "[AUTOMOD]: Response";
				break;
		}

		return {
			action,
			reason,
			response,
			deleteMessage
		};
	}
}
