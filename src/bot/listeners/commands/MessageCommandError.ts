import { ArgumentError, Events, MessageCommandErrorPayload, UserError } from "@sapphire/framework";
import { DiscordAPIError, HTTPError } from "discord.js";
import { Listener } from "../../../client";
import { RESTJSONErrorCodes } from "discord-api-types/v9";
import { ApplyOptions } from "@sapphire/decorators";
import { codeBlock } from "@sapphire/utilities";
import { emojis } from "../../../client/constants";

const ignoredCodes = [RESTJSONErrorCodes.UnknownChannel, RESTJSONErrorCodes.UnknownMessage];

@ApplyOptions<Listener.Options>({ event: "messageCommandError" })
export default class extends Listener {
	public async run(error: Error, { message, command }: MessageCommandErrorPayload) {
		const author = message.author.id;
		const errorEmoji = emojis.error;

		// If string || UserError, send to user
		if (typeof error === "string") {
			await message.reply(`>>> ${errorEmoji} | ${error}`);
			return;
		}
		if (error instanceof ArgumentError) {
			await message.reply(`>>> ${errorEmoji} | ${error}`);
			return;
		}
		if (error instanceof UserError) {
			await message.reply(`>>> ${errorEmoji} | ${error}`);
			return;
		}

		if (error.name === "AbortError" || error.message === "Internal Server Error") {
			this.container.logger.warn(
				`${this.getWarnError(author, message.id, message.channelId, message.guildId)} (${author}) | ${error.constructor.name} | ${
					error.message
				}`
			);

			await message.reply(
				`>>> ${errorEmoji} | Oh no, this doesn't look very good. Something caused the request to abort their mission, please try again.`
			);
			return;
		}

		// checks if error is DiscordAPIError || HTTPError
		if (error instanceof DiscordAPIError || error instanceof HTTPError) {
			if (this.isSilencedError(message.channelId, message.guildId, error)) return;
			this.container.client.emit("error", error);
		} else {
			this.container.logger.warn(
				`${this.getWarnError(author, message.id, message.channelId, message.guildId)} (${author}) | ${error.constructor.name} | ${
					error.message
				}`
			);
		}

		this.container.logger.fatal(`[COMMAND] ${command.location.relative}\n${error.stack || error.message}`);

		try {
			await message.reply(this.generateUnexpectedErrorMessage(author, error));
		} catch (err) {
			this.container.client.emit(Events.Error, err);
		}
	}

	private isSilencedError(channelId: string, guild: string | null, error: DiscordAPIError | HTTPError) {
		return ignoredCodes.includes(error.code) || this.isDirectMessageReplyAfterBlock(channelId, guild, error);
	}

	private isDirectMessageReplyAfterBlock(channelId: string, guild: string | null, error: DiscordAPIError | HTTPError) {
		if (error.code !== RESTJSONErrorCodes.CannotSendMessagesToThisUser) return false;
		if (guild !== null) return false;
		return error.path === `/channels/${channelId}/messages`;
	}

	private generateUnexpectedErrorMessage(authorId: string, error: Error) {
		if (this.container.client.owners.includes(authorId)) return codeBlock("js", error.stack ?? error.message);

		return `>>> ${emojis.error} | Oh no, this doesn't look very good.\n**Error**: \`${error.message}\`\nIf this keeps happening, please DM the developer of this bot.`;
	}

	private getWarnError(author: string, id: string, channelId?: string, guildId?: string | null) {
		return `ERROR: /${guildId ? `${guildId}/${channelId}` : `DM/${author}`}/${id}`;
	}
}
