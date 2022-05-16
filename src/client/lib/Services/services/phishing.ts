import axios from "axios";
import { Service } from "../base";

const SUSPICIOUS_URL = "https://raw.githubusercontent.com/nikolaischunk/discord-phishing-links/main/suspicious-list.json";
const GUARANTEED_URL = "https://raw.githubusercontent.com/nikolaischunk/discord-phishing-links/main/domain-list.json";

interface phishingLinksData {
	domains: string[];
}

export default class extends Service {
	public init() {
		/* Run every 10 minutes */
		setInterval(this.run.bind(this), 6e5);
		void this.run();
	}

	private async run() {
		try {
			const suspicious = await axios.get<phishingLinksData>(SUSPICIOUS_URL);
			const guaranteed = await axios.get<phishingLinksData>(GUARANTEED_URL);

			this.client.automod.phishing = {
				suspicious: suspicious.data.domains,
				guaranteed: guaranteed.data.domains
			};
		} catch (err) {
			this.client.logger.fatal(`[SERVICE: PHISHING] => Failed to update phishing links`, err);
		}
	}
}
