import { Command } from "../../../client/";
import { ApplyOptions } from "@sapphire/decorators";
import { CommandInteraction, EmbedFieldData, Message, MessageEmbed, Permissions, User } from "discord.js";
import ms from "ms";

@ApplyOptions<Command.Options>({
	name: "help",
	aliases: ["commands"],
	description: "A list of all the commands",
	requiredClientPermissions: ["EMBED_LINKS"],
	usage: "[command]",
	chatInputCommand: {
		messageCommand: true,
		register: true,
		options: [
			{
				name: "command",
				type: "STRING",
				description: "The name of the command",
				required: false
			}
		]
	}
})
export default class extends Command {
	public async messageRun(message: Message, args: Command.Args, context: Command.MessageContext): Promise<void> {
		const locale = message.guild?.preferredLocale || "en";
		const cmd = await args.pickResult("string");
		const command = this.container.stores.get("commands").get(cmd.value ?? "") as Command | undefined;

		const embed = this.RunCommand(context, message.author, command, locale);

		await message.reply({ embeds: [embed] });
	}

	public async chatInputRun(interaction: CommandInteraction, context: Command.SlashCommandContext) {
		const cmd = interaction.options.getString("command", false);
		const command = this.container.stores.get("commands").get(cmd ?? "") as Command | undefined;
		const embed = this.RunCommand(context, interaction.user, command, interaction.locale);

		await interaction.reply({
			embeds: [embed]
		});
	}

	private RunCommand(
		context: Command.MessageContext | Command.SlashCommandContext,
		user: User,
		command: Command | undefined,
		locale: string
	): MessageEmbed {
		const embed = this.client.utils.embed();
		const basePath = `general:${this.name}`;

		if (command) {
			embed.setTitle(this.t(locale, `${basePath}.title`, { command: command.name }));

			const getTitle = (str: string) => `➤ **${str}**`;

			const userPermissions =
				new Permissions(command.permissions)
					.toArray()
					.map((str) => this.t(locale, `permissions:${str}`))
					.join("` ") || "-";
			const clientPermissions =
				new Permissions(command.clientPermissions)
					.toArray()
					.map((str) => this.t(locale, `permissions:${str}`))
					.join("` ") || "-";

			const { description, usage: _usage } = this.client.localeManager.getCommandData(command.name, locale) ?? {
				description: this.description,
				options: {},
				usage: this.usage
			};

			const detailsTitle = this.t(locale, `${basePath}.info.details.title`);
			const usage = this.t(locale, `${basePath}.info.details.usage`, { command: `${command.name} ${_usage}` });
			const category = this.t(locale, `${basePath}.info.details.category`, { category: this.category });

			const permissionsTitle = this.t(locale, `${basePath}.info.permissions.title`);
			const userPerms = this.t(locale, `${basePath}.info.permissions.user`, { permissions: userPermissions });
			const botPerms = this.t(locale, `${basePath}.info.permissions.bot`, { permissions: clientPermissions });

			const ratelimitTitle = this.t(locale, `${basePath}.info.ratelimit.title`);
			const ratelimit = this.t(locale, `${basePath}.info.ratelimit.message`, {
				amount: this.cooldownLimit,
				duration: ms(this.cooldown)
			});

			/*
				The playlists command, with multiple sub commands.

				▶ **Details**
				Usage: `/playlists`
				Category: `Playlists`

				▶ **Permissions**
				User: `-` 
				Bot: `Embed Links`, `Send Message`

				▶ **Ratelimit**
				You can run this command **2 times** every **10s**.
			*/

			embed.setDescription(
				[
					description,
					"",
					getTitle(detailsTitle),
					usage,
					category,
					"",
					getTitle(permissionsTitle),
					userPerms,
					botPerms,
					"",
					getTitle(ratelimitTitle),
					ratelimit
				].join("\n")
			);
		} else {
			embed.setTitle(this.t(locale, `${basePath}.title`, { command: this.name }));
			embed.setDescription(this.t(locale, `${basePath}.description`));

			const isOwner = this.client.isOwner(user.id);
			const commands = [...this.container.stores.get("commands").values()] as Command[];
			let categories = [...new Set(commands.map((c) => c.category ?? "default"))];

			if (!isOwner) categories = categories.filter((c) => c.toLowerCase() !== "developers");

			const fields: EmbedFieldData[] = categories.map((category) => {
				const valid = commands.filter((c) => c.category === category);
				const filtered = isOwner ? valid : valid.filter((c) => !c.hidden || !c.OwnerOnly);

				return {
					name: `• ${category}`,
					value: filtered.map((c) => `\`${c.name ?? c.aliases[0] ?? "unkown"}\``).join(" ")
				};
			});

			embed.setFields(fields);
		}

		return embed;
	}
}
