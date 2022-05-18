import { SapphireClient } from "@sapphire/framework";
import { ActivitiesOptions, BitFieldResolvable, Collection, IntentsString, PartialTypes, PresenceStatusData } from "discord.js";
import { join } from "path";
import { PrismaClient } from "@prisma/client";
import { AutoMod, BlacklistManager, Utils, ServiceHandler } from "./lib";
import type { FullGuildConfig } from "./";

import "@daangamesdg/sapphire-logger/register";

export class Client extends SapphireClient {
	public owners: string[];

	// Classes
	public prisma = new PrismaClient();
	public utils: Utils = new Utils(this);
	public automod: AutoMod = new AutoMod(this);

	// ServiceHandler
	public serviceHandler: ServiceHandler = new ServiceHandler(this);

	// managers
	public blacklistManager: BlacklistManager = new BlacklistManager(this);

	// cache
	public guildConfig = new Collection<string, FullGuildConfig>();

	public constructor(options: ClientOptions) {
		super({
			intents: options.intents,
			allowedMentions: { users: [], roles: [], repliedUser: false },
			baseUserDirectory: join(__dirname, "..", "bot"),
			defaultPrefix: process.env.PREFIX,
			partials: options.partials,
			loadDefaultErrorListeners: false,
			loadMessageCommandListeners: true,
			presence: {
				activities: options.activity,
				status: options.status
			}
		});

		this.owners = options.owners;

		process.on("unhandledRejection", this.handleRejection.bind(this));
	}

	public isOwner(id: string): boolean {
		return this.owners.includes(id);
	}

	public async start(): Promise<void> {
		await this.prisma.$connect();
		this.logger.info("Successfully connected to postgreSQL Database via Prisma!");

		const blacklisted = await this.prisma.botBlacklist.findMany();
		this.blacklistManager.setBlacklisted(blacklisted.map((b) => b.id));

		await this.serviceHandler.start();
		await this.login(process.env.TOKEN);
	}

	private handleRejection(reason: unknown) {
		this.logger.fatal("[Process]: Unhandled rejection: ", reason);
	}
}

interface ClientOptions {
	intents: BitFieldResolvable<IntentsString, number>;
	owners: string[];
	partials?: PartialTypes[] | undefined;
	activity?: ActivitiesOptions[] | undefined;
	status?: PresenceStatusData | undefined;
}

declare module "@sapphire/framework" {
	class SapphireClient {
		// Data
		public owners: string[];

		// Classes
		public prisma: PrismaClient;
		public utils: Utils;

		// managers
		public blacklistManager: BlacklistManager;

		// functions
		public isOwner(id: string): boolean;
	}

	interface Preconditions {
		OwnerOnly: never;
		Blacklisted: never;
	}
}
