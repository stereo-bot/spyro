import { Listener } from "../../../client";
import { ApplyOptions } from "@sapphire/decorators";
import type { Guild } from "discord.js";

@ApplyOptions<Listener.Options>({ event: "guildDelete" })
export default class extends Listener {
	public run(guild: Guild) {
		this.container.logger.debug(`[GUILD]: Guild left - ${guild.name} (${guild.id})`);
		void this.client.configManager.scheduleDelete(guild.id);
	}
}
