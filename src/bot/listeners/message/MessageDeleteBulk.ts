import { GuildMessage, Listener } from "../../../client";
import { ApplyOptions } from "@sapphire/decorators";
import type { Collection } from "discord.js";

@ApplyOptions<Listener.Options>({ event: "messageDeleteBulk" })
export default class extends Listener {
	public run(messages: Collection<string, GuildMessage>) {
		this.client.messageLogger.onMessageDeleteBulk(messages);
	}
}
