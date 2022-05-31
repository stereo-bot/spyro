import { GuildMessage, Listener } from "../../../client";
import { ApplyOptions } from "@sapphire/decorators";
import type { Message } from "discord.js";

@ApplyOptions<Listener.Options>({ event: "messageUpdate" })
export default class extends Listener {
	public async run(messageOld: Message, messageNew: Message) {
		if (!messageNew.inGuild()) return;

		this.client.messageLogger.onMessageUpdate(messageOld as GuildMessage, messageNew as GuildMessage);
		if (messageOld.content.toLowerCase() !== messageNew.content.toLowerCase()) await this.client.automod.run(messageNew as GuildMessage);
	}
}
