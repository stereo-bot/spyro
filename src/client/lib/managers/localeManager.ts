import { join } from "node:path";
import { readdirSync, readFileSync } from "node:fs";
import type { Client } from "../../";
import * as constants from "../../constants";
import { dotprop } from "../";

interface LocaleCommandOptions {
	[option: string]: {
		name: string;
		description: string;
	};
}

export class LocaleManager {
	public languages: Record<string, Record<string, string>> = {};

	public constructor(public client: Client) {}

	public loadAll() {
		this.languages = this.read(join(process.cwd(), "locales"));
	}

	public translate(id: string | null | undefined, path: string, vars: Record<string, unknown> = {}): string {
		// @ts-ignore aaa
		const language = (id ? this.client.configManager.get(id)?.language : null) ?? "en";
		const emojis = Object.keys(constants.emojis).reduce(
			(o, key) =>
				Object.assign(o, {
					[`emoji.${key}`]: (constants.emojis as Record<string, string>)[key]
				}),
			{}
		);

		return this.get(language, path, { ...emojis, ...vars });
	}

	public getCommandData(command: string, language: string) {
		const lang = this.languages[language];
		if (!lang) return null;

		const parsed = this.parse(lang.commands);
		const description = dotprop.get(parsed, `${command}.description`) as string;
		const options = dotprop.get(parsed, `${command}.options`) as LocaleCommandOptions;

		return {
			description,
			options
		};
	}

	public get(language: string, _path: string, vars: Record<string, unknown> = {}): string {
		const lang = this.languages[language];
		if (!lang) return `Lanuage ${language} was not found`;

		const [_file, path] = _path.split(":");
		const parsed = this.parse(lang[_file]);

		let data = dotprop.get(parsed, path) as string;
		if (typeof data !== "string" || !data.length) return `${_path} is not a valid language path`;

		for (const key of Object.keys(vars)) data = data.replace(new RegExp(`{${key}}`, "gi"), `${vars[key]}`);

		data = this.permissions(lang, data);

		const res = data ?? `${_path} is not a valid language path`;
		return res.length > 2e3 ? `${res.slice(0, 2e3 - 3)}...` : res;
	}

	private permissions(lang: Record<string, string>, str: string): string {
		const perms = this.parse(lang.permissions);
		if (!perms) return str;

		for (const perm of Object.keys(perms)) str = str.replace(new RegExp(`{${perm}}`, "gi"), `${perms[perm]}`);

		return str;
	}

	private parse(file: string) {
		const data = readFileSync(file, { encoding: "utf8" });
		return JSON.parse(data);
	}

	private read(dir: string): Record<string, Record<string, string>> {
		const data: Record<string, Record<string, string>> = {};

		for (const language of readdirSync(dir)) {
			const final = join(dir, language);
			const files = readdirSync(final);

			data[language] = files.reduce((o, key) => Object.assign(o, { [key.split(".")[0]]: join(final, key) }), {});
		}

		return data;
	}
}
