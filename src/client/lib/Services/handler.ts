import { readdir } from "fs/promises";
import { join } from "path";
import type { Client } from "../../client";

export class ServiceHandler {
	public constructor(public client: Client) {}

	public async start() {
		const basePath = join(__dirname, "./services");
		const files = await readdir(basePath);

		for (const filePath of files) {
			if (!filePath.endsWith(".ts") && !filePath.endsWith(".js")) return;

			const path = join(basePath, filePath);
			const { default: File } = await import(path);

			new File(this.client).init();
			this.client.logger.info(`[SERVICE: ${filePath.substring(0, filePath.length - 3).toUpperCase()}]: service is up and running`);
		}
	}
}
