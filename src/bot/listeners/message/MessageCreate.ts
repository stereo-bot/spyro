import { Listener } from "../../../client";
import { ApplyOptions } from "@sapphire/decorators";
import type { Message } from "discord.js";

@ApplyOptions<Listener.Options>({ event: "messageCreate" })
export default class extends Listener {
	public run(message: Message) {
		if (message.inGuild()) {
			// @ts-ignore some weird error while inGuild should always return guildmember
			void this.client.automod.run(message);
		}
	}
}
