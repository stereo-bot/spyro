import type { Guild, User } from "discord.js";
import type { Client } from "../../../client";
import type { ModlogType } from "../../../types";
import type { Modlog as iModlog } from "@prisma/client";
import { getCaseId } from "../../utils";

export class Modlog {
	public id!: string;
	public guild!: Guild;
	public member!: User;
	public moderator!: User;

	public locale!: string;
	public caseId!: number;

	public date!: Date;
	public expire?: Date;

	public reason!: string;
	public modlogType!: ModlogType;

	public constructor(public client: Client, data?: iModlog) {
		if (data) void this._update(data);
	}

	public toString(): string {
		return `#${this.caseId}`;
	}

	public async update(data: Partial<iModlog>) {
		const newData = await this.client.prisma.modlog.update({ where: { id: this.id }, data });
		await this._update(newData);

		return newData;
	}

	public async delete() {
		const newData = await this.client.prisma.modlog.delete({ where: { id: this.id } });
		await this._update(newData);

		return newData;
	}

	/**
	 * Only use this if you want to create a modlog from the provided data
	 */
	public async create(data: iModlog) {
		const [guildId] = data.id.split("-");
		if (this.guild) return this;

		data.id = await getCaseId(this.client, guildId);
		await this.client.prisma.modlog.create({ data });

		await this._update(data);
		return this;
	}

	private async _update(data: iModlog) {
		const [guildId, caseId] = data.id.split("-");

		const guild = this.client.guilds.cache.get(guildId);
		const config = this.client.configManager.get(guildId);
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

		this.caseId = Number(caseId);
		this.id = data.id;
	}
}
