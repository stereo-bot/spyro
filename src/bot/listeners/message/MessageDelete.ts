import { GuildMessage, Listener } from "../../../client";
import { ApplyOptions } from "@sapphire/decorators";
import type { Message } from "discord.js";

@ApplyOptions<Listener.Options>({ event: "messageDelete" })
export default class extends Listener {
	public run(message: Message) {
		if (!message.inGuild()) return;

		const config = this.client.configManager.get(message.guildId);
		const { messageEnabled } = config.logging;
		if (!messageEnabled) return;

		this.client.messageLogger.onMessageDelete(message as GuildMessage);
	}
}
