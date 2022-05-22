import { Listener } from "../../../client";
import { ApplyOptions } from "@sapphire/decorators";
import type { Guild } from "discord.js";

@ApplyOptions<Listener.Options>({ event: "guildCreate" })
export default class extends Listener {
	public async run(guild: Guild) {
		this.container.logger.debug(`[GUILD]: New guild joined - ${guild.name} (${guild.id})`);
		await this.client.configManager.load(guild.id);
	}
}
