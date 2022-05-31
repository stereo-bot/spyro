import { Command, Modlog, ModlogType, getCaseId, isModeratable } from "../../../client";
import { ApplyOptions } from "@sapphire/decorators";
import type { CommandInteraction, Message, User } from "discord.js";

@ApplyOptions<Command.Options>({
	name: "warn",
	aliases: ["warning"],
	description: "Warn a server member",
	usage: "<user> [reason]",
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
		const { value: reason } = await args.restResult("string");
		if (!member) {
			await message.reply(this.t(locale, "mod_commands:warn.no_user"));
			return;
		}

		const moderatable = isModeratable(member, message.member!, member.guild.me!);
		if (moderatable) {
			await message.reply(this.t(locale, moderatable));
			return;
		}

		await this.sharedRun(member.user, message.author, locale, message.guildId, reason);
		await message.reply(this.t(locale, "mod_commands:warn.response", { user: member.user.tag, reason }));
	}

	public async chatInputRun(interaction: CommandInteraction<"cached">): Promise<void> {
		await interaction.deferReply();
		const { locale } = this.client.configManager.get(interaction.guildId);
		const member = interaction.options.getMember("user", true);
		const reason = interaction.options.getString("reason") ?? undefined;

		const moderatable = isModeratable(member, interaction.member, interaction.guild.me!);
		if (moderatable) {
			await interaction.followUp(this.t(locale, moderatable));
			return;
		}

		await this.sharedRun(member.user, interaction.user, locale, interaction.guildId, reason);
		await interaction.followUp(this.t(interaction.locale, "mod_commands:warn.response", { user: member.user.tag, reason }));
	}

	private async sharedRun(user: User, moderator: User, locale: string, guildId: string, reason?: string) {
		const id = await getCaseId(this.client, guildId);
		const [, caseId] = id.split("-");
		reason ??= this.t(locale, "logging:mod.no_reason", { id: caseId });

		const modlog = new Modlog(this.client);
		await modlog.create({
			date: new Date(),
			expire: null,
			member: user.id,
			moderator: moderator.id,
			modlogType: ModlogType.WARN,
			reason,
			id
		});

		this.client.modLogger.onModAdd(modlog);
	}
}
