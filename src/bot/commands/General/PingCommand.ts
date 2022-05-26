import { Command } from "../../../client/";
import { ApplyOptions } from "@sapphire/decorators";
import type { CommandInteraction, Message } from "discord.js";

@ApplyOptions<Command.Options>({
	name: "ping",
	aliases: ["pong"],
	description: "Ping! Pong! 🏓",
	chatInputCommand: {
		register: true,
		messageCommand: true
	}
})
export default class extends Command {
	public async messageRun(message: Message): Promise<void> {
		const locale = message.guild?.preferredLocale || "en";
		const msg = await message.reply(this.getTranslations("loading", locale));
		await msg.edit(
			this.getTranslations("response", locale, { heartbeat: this.client.ws.ping, roundtrip: msg.createdTimestamp - message.createdTimestamp })
		);
	}

	public async chatInputRun(interaction: CommandInteraction): Promise<void> {
		const interactionDate = Date.now();
		await interaction.reply(this.getTranslations("loading", interaction.locale));

		await interaction.editReply(
			this.getTranslations("response", interaction.locale, { heartbeat: this.client.ws.ping, roundtrip: Date.now() - interactionDate })
		);
	}

	private getTranslations(type: "loading" | "response", locale: string, vars?: Record<string, unknown>) {
		if (type === "loading") return `🏓 | ${this.t(locale, "common:loading", vars)}...`;

		return this.t(locale, "general:ping.response", vars);
	}
}
