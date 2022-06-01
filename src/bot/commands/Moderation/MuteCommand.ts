import { Command, Modlog, ModlogType, getCaseId, isModeratable } from "../../../client";
import { ApplyOptions } from "@sapphire/decorators";
import type { CommandInteraction, Message, User } from "discord.js";
import ms from "ms";
import moment from "moment";

@ApplyOptions<Command.Options>({
	name: "mute",
	description: "Mute a server member for a given duration",
	usage: "<user> <duration> [reason]",
	preconditions: ["GuildOnly"],
	requiredUserPermissions: ["MODERATE_MEMBERS"],
	chatInputCommand: {
		register: true,
		messageCommand: true,
		options: [
			{
				name: "user",
				description: "The user you want to give a warning to.",
				type: "USER",
				required: true
			},
			{
				name: "duration",
				description: "The amount of time you want to mute this person.",
				type: "STRING",
				required: true
			},
			{
				name: "reason",
				description: "The reason why you gave them a warning.",
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
		const { value: _duration } = await args.pickResult("string");
		const { value: reason } = await args.restResult("string");
		if (!member) {
			await message.reply(this.t(locale, "mod_commands:global.no_user"));
			return;
		}

		if (!_duration) {
			await message.reply(this.t(locale, "mod_commands:global.no_duration"));
			return;
		}

		const duration = ms(_duration);
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
		await message.reply(this.t(locale, "mod_commands:mute.response", { user: member.user.tag, reason: reason ?? "-", duration: ms(duration) }));
	}

	public async chatInputRun(interaction: CommandInteraction<"cached">): Promise<void> {
		await interaction.deferReply();
		const { locale } = this.client.configManager.get(interaction.guildId);
		const member = interaction.options.getMember("user", true);
		const _duration = interaction.options.getString("duration", true);
		const reason = interaction.options.getString("reason") ?? undefined;

		const moderatable = isModeratable(member, interaction.member, interaction.guild.me!);
		if (moderatable) {
			await interaction.followUp(this.t(locale, moderatable));
			return;
		}

		const duration = ms(_duration);
		if (isNaN(duration)) {
			await interaction.followUp(this.t(locale, "mod_commands:global.no_duration"));
			return;
		}

		await this.sharedRun(member.user, interaction.user, locale, interaction.guildId, duration, reason);
		await interaction.followUp(
			this.t(interaction.locale, "mod_commands:mute.response", { user: member.user.tag, reason: reason ?? "-", duration: ms(duration) })
		);
	}

	private async sharedRun(user: User, moderator: User, locale: string, guildId: string, duration: number, reason?: string) {
		const id = await getCaseId(this.client, guildId);
		const [, caseId] = id.split("-");
		reason ??= this.t(locale, "logging:mod.no_reason", { id: caseId });

		const modlog = new Modlog(this.client);
		const date = new Date();
		const expire = moment(date).add(duration).toDate();
		await modlog.create({
			date,
			expire,
			member: user.id,
			moderator: moderator.id,
			modlogType: ModlogType.MUTE,
			reason,
			id
		});

		await this.client.modaction.mute(modlog, duration);
	}
}
