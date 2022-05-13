import {
	PreconditionOptions,
	PreconditionContext,
	Precondition as SapphirePrecondition,
	PreconditionResult,
	AsyncPreconditionResult,
	PieceContext
} from "@sapphire/framework";
import type { Client } from "../../../";

export abstract class Precondition extends SapphirePrecondition {
	public client: Client;

	public constructor(context: PieceContext, options: PreconditionOptions) {
		super(context, options);

		this.client = this.container.client as Client;
	}
}

export namespace Precondition {
	export type Context<O = Record<PropertyKey, unknown>> = PreconditionContext & O;
	export type Result = PreconditionResult;
	export type AsyncResult = AsyncPreconditionResult;
}
