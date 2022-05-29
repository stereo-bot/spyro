import { ModerationAction } from "@prisma/client";
import type { Client } from "../../../client";
import type { AutoModResults } from "./types";
import { Modlog } from "./Modlog";
import { getCaseId } from "../../utils";

export class ModAction {
	public constructor(public client: Client) {}

	public handleResults(results: AutoModResults[]) {
		results.forEach(async (res) => {
			const config = this.getAutomodConfig(res.guild, res.key);
			if (config.action !== ModerationAction.VERBAL) {
				const id = await getCaseId(this.client, res.guild);
				const data = {
					date: new Date(),
					expire: null,
					member: res.user,
					moderator: this.client.user!.id,
					reason: "",
					modlogType: 1,
					id
				};

				const modlog = new Modlog(this.client);
				await modlog.create(data);

				this.client.modLogger.onModAdd(modlog);
				// TODO: Take correct action (ban/mute/warn) and DM user
			}
		});
	}

	private getAutomodConfig(guildId: string, key: string) {
		const config = this.client.configManager.get(guildId);

		let action: ModerationAction;
		let deleteMessage: boolean;

		switch (key) {
			case "AUTOMOD_INVITE":
				action = config.automod.inviteAction;
				deleteMessage = config.automod.inviteDelete;
				break;
			default:
				action = ModerationAction.VERBAL;
				deleteMessage = true;
				break;
		}

		return {
			action,
			deleteMessage
		};
	}
}
