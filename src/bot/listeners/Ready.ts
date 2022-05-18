import { FullGuildConfig, Listener } from "../../client";
import { ApplyOptions } from "@sapphire/decorators";

@ApplyOptions<Listener.Options>({ event: "ready", once: true })
export default class extends Listener {
	public run() {
		this.container.logger.info(`${this.client.user!.tag} has logged in!`);

		this.client.guilds.cache.forEach(async (guild) => {
			let guildConfig = await this.client.prisma.guildConfig.findUnique({
				where: { id: guild.id },
				select: { automod: true, logging: true, id: true }
			});
			if (!guildConfig)
				guildConfig = await this.client.prisma.guildConfig.create({
					data: { id: guild.id, automod: { create: {} }, logging: { create: {} } },
					select: { automod: true, logging: true, id: true }
				});
			this.client.guildConfig.set(guild.id, guildConfig as unknown as FullGuildConfig);
		});
	}
}
