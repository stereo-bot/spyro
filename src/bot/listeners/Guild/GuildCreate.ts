import { FullGuildConfig, Listener } from "../../../client";
import { ApplyOptions } from "@sapphire/decorators";
import type { Guild } from "discord.js";

@ApplyOptions<Listener.Options>({ event: "guildCreate" })
export default class extends Listener {
	public async run(guild: Guild) {
		this.container.logger.debug(`[GUILD]: New guild joined - ${guild.name} (${guild.id})`);

		let guildConfig = await this.client.prisma.guildConfig.findUnique({
			where: { id: guild.id },
			select: { automod: true, logging: true, id: true }
		});
		if (!guildConfig)
			guildConfig = await this.client.prisma.guildConfig.create({ data: { id: guild.id }, select: { automod: true, logging: true, id: true } });
		this.client.guildConfig.set(guild.id, guildConfig as unknown as FullGuildConfig);
	}
}
