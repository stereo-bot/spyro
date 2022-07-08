import { Command, Modlog, ModlogType, getCaseId, isModeratable } from "../../../client";
import { ApplyOptions } from "@sapphire/decorators";
import type { CommandInteraction, Message, User } from "discord.js";
import ms from "ms";
import moment from "moment";

@ApplyOptions<Command.Options>({
	name: "ban",
	description: "Ban a server member from the server",
	usage: "<user> [reason] [--duration=<duration>]",
	options: ["duration"],
	preconditions: ["GuildOnly"],
	requiredUserPermissions: ["BAN_MEMBERS"],
	requiredClientPermissions: ["BAN_MEMBERS"],
	chatInputCommand: {
		register: true,
		messageCommand: true,
		options: [
			{
				name: "user",
				description: "The user you want to ban from the server.",
				type: "USER",
				required: true
			},
			{
				name: "duration",
				description: "The amount of time the ban should last.",
				type: "STRING",
				required: false
			},
			{
				name: "reason",
				description: "The reason why you banned this user.",
				type: "STRING",
				required: false
			}
		]
	}
})
export default class extends Command {
	public async messageRun(message: Message<true>, args: Command.Args): Promise<void> {
		const { locale } = this.client.configManager.get(message.guildId);
		const { value: member } = await args.pickResult("member");
		const { value: reason } = await args.restResult("string");
		const _duration = args.getOption("duration");
		if (!member) {
			await message.reply(this.t(locale, "mod_commands:global.no_user"));
			return;
		}

		const duration = ms(_duration ?? "0s");
		if (isNaN(duration)) {
			await message.reply(this.t(locale, "mod_commands:global.no_duration"));
			return;
		}

		const moderatable = isModeratable(member, message.member!, member.guild.me!);
		if (moderatable) {
			await message.reply(this.t(locale, moderatable));
			return;
		}

		await this.sharedRun(member.user, message.author, locale, message.guildId, duration, reason);
		await message.reply(this.t(locale, "mod_commands:ban.response", { user: member.user.tag, reason: reason ?? "-" }));
	}

	public async chatInputRun(interaction: CommandInteraction<"cached">): Promise<void> {
		await interaction.deferReply();
		const { locale } = this.client.configManager.get(interaction.guildId);
		const member = interaction.options.getMember("user", true);
		const _duration = interaction.options.getString("duration") ?? "0s";
		const reason = interaction.options.getString("reason") ?? undefined;

		const moderatable = isModeratable(member, interaction.member, interaction.guild.me!);
		if (moderatable) {
			await interaction.followUp(this.t(locale, moderatable));
			return;
		}

		const duration = ms(_duration ?? "0s");
		if (isNaN(duration)) {
			await interaction.followUp(this.t(locale, "mod_commands:global.no_duration"));
			return;
		}

		await this.sharedRun(member.user, interaction.user, locale, interaction.guildId, duration, reason);
		await interaction.followUp(this.t(interaction.locale, "mod_commands:ban.response", { user: member.user.tag, reason: reason ?? "-" }));
	}

	private async sharedRun(user: User, moderator: User, locale: string, guildId: string, duration: number, reason?: string) {
		const id = await getCaseId(this.client, guildId);
		const [, caseId] = id.split("-");
		reason ??= this.t(locale, "logging:mod.no_reason", { id: caseId });

		const modlog = new Modlog(this.client);
		const date = new Date();
		await modlog.create({
			date,
			expire: duration ? moment(date).add(duration).toDate() : null,
			member: user.id,
			moderator: moderator.id,
			modlogType: ModlogType.BAN,
			reason,
			id
		});

		await this.client.modaction.ban(modlog);
	}
}
