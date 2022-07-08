import { Command, Modlog, ModlogType, getCaseId, isModeratable } from "../../../client";
import { ApplyOptions } from "@sapphire/decorators";
import type { CommandInteraction, Message, User } from "discord.js";

@ApplyOptions<Command.Options>({
	name: "kick",
	description: "Kick a server member from the server",
	usage: "<user> [reason]",
	preconditions: ["GuildOnly"],
	requiredUserPermissions: ["KICK_MEMBERS"],
	requiredClientPermissions: ["KICK_MEMBERS"],
	chatInputCommand: {
		register: true,
		messageCommand: true,
		options: [
			{
				name: "user",
				description: "The user you want to kick.",
				type: "USER",
				required: true
			},
			{
				name: "reason",
				description: "The reason why you kicked them from the server.",
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
			await message.reply(this.t(locale, "mod_commands:global.no_user"));
			return;
		}

		const moderatable = isModeratable(member, message.member!, member.guild.me!);
		if (moderatable) {
			await message.reply(this.t(locale, moderatable));
			return;
		}

		await this.sharedRun(member.user, message.author, locale, message.guildId, reason);
		await message.reply(this.t(locale, "mod_commands:kick.response", { user: member.user.tag, reason: reason ?? "-" }));
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
		await interaction.followUp(this.t(interaction.locale, "mod_commands:kick.response", { user: member.user.tag, reason: reason ?? "-" }));
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
			modlogType: ModlogType.KICK,
			reason,
			id
		});

		await this.client.modaction.kick(modlog);
	}
}
