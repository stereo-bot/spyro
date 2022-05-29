import type { Guild, User } from "discord.js";
import type { Client } from "../../../client";
import type { ModlogType } from "../../../types";
import type { Modlog as iModlog } from "@prisma/client";

export class Modlog {
	public guild!: Guild;
	public member!: User;
	public moderator!: User;

	public locale!: string;
	public caseId!: number;

	public date!: Date;
	public expire?: Date;

	public reason!: string;
	public modlogType!: ModlogType;

	public constructor(public client: Client, data: iModlog) {
		void this._update(data);
	}

	public toString(): string {
		return `#${this.caseId}`;
	}

	public async update(data: Partial<iModlog>) {
		const newData = await this.client.prisma.modlog.update({ where: { case: this.caseId }, data });
		await this._update(newData);

		return newData;
	}

	private async _update(data: iModlog) {
		const guild = this.client.guilds.cache.get(data.guildId);
		const config = this.client.configManager.get(data.guildId);
		if (!guild) throw new Error("[Modlog]: Expected a cached guild but received undefined");

		let moderator = guild.members.cache.get(data.moderator)?.user;
		if (!moderator) moderator = await this.client.users.fetch(data.moderator);
		if (!moderator) throw new Error("[Modlog]: Expected a user for field 'moderator' but received undefined");

		let member = guild.members.cache.get(data.member)?.user;
		if (!member) member = await this.client.users.fetch(data.member);
		if (!member) throw new Error("[Modlog]: Expected a user for field 'member' but received undefined");

		this.guild = guild;
		this.locale = config.locale;

		this.member = member;
		this.moderator = moderator;

		this.date = data.date;
		this.expire = data.expire ?? undefined;

		this.reason = data.reason;
		this.modlogType = data.modlogType;

		this.caseId = data.case;
	}
}
