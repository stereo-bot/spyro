import { Command } from "../../../client/";
import { ApplyOptions } from "@sapphire/decorators";
import {
	AutocompleteInteraction,
	CommandInteraction,
	EmbedFieldData,
	Message,
	MessageActionRow,
	MessageButton,
	MessageEmbed,
	Permissions,
	User
} from "discord.js";
import ms from "ms";
import { INVITE_LINK, SUPPORT_SERVER, WEBSITE } from "../../../client/constants";
import Fuse from "fuse.js";

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
				required: false,
				autocomplete: true
			}
		]
	}
})
export default class extends Command {
	public async autocompleteRun(interaction: AutocompleteInteraction) {
		let commands = [...this.container.stores.get("commands").values()] as Command[];
		if (!this.client.isOwner(interaction.user.id)) commands = commands.filter((c) => !c.OwnerOnly);
		const search = new Fuse(commands, {
			keys: ["name", "description"]
		});

		const input = interaction.options.getString("command", false) ?? "";
		if (!input) return interaction.respond(commands.map((cmd) => ({ name: this.client.utils.capitalize(cmd.name), value: cmd.name })));

		const results = search.search(input);
		await interaction.respond(results.map((res) => ({ name: this.client.utils.capitalize(res.item.name), value: res.item.name })));
	}

	public async messageRun(message: Message, args: Command.Args): Promise<void> {
		const { locale } = this.client.configManager.get(message?.guildId ?? "");
		const cmd = await args.pickResult("string");
		const command = this.container.stores.get("commands").get(cmd.value ?? "") as Command | undefined;

		const embed = this.RunCommand(message.author, command, locale);
		const buttons = this.getButtons(locale);

		await message.reply({ embeds: [embed], components: [buttons] });
	}

	public async chatInputRun(interaction: CommandInteraction) {
		const cmd = interaction.options.getString("command", false);
		const command = this.container.stores.get("commands").get(cmd ?? "") as Command | undefined;

		const embed = this.RunCommand(interaction.user, command, interaction.locale);
		const buttons = this.getButtons(interaction.locale);

		await interaction.reply({
			embeds: [embed],
			components: [buttons]
		});
	}

	private getButtons(locale: string) {
		const basePath = `general:${this.name}`;

		const buttons = new MessageActionRow().addComponents(
			new MessageButton()
				.setLabel(this.t(locale, `${basePath}.buttons.invite`))
				.setStyle("LINK")
				.setURL(INVITE_LINK),
			new MessageButton()
				.setLabel(this.t(locale, `${basePath}.buttons.support`))
				.setStyle("LINK")
				.setURL(SUPPORT_SERVER),
			new MessageButton()
				.setLabel(this.t(locale, `${basePath}.buttons.website`))
				.setStyle("LINK")
				.setURL(WEBSITE)
		);

		return buttons;
	}

	private RunCommand(user: User, command: Command | undefined, locale: string): MessageEmbed {
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
				description: command.description,
				options: {},
				usage: command.usage
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
