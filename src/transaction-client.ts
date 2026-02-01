import type { HttpClient } from "./http-client.ts";
import type {
	QueryOptions,
	SparqlBindings,
	StatementOptions,
} from "./repository-client.ts";
import { ContentTypes } from "./types.ts";

/** Client for transaction operations */
export class TransactionClient {
	private active = true;

	constructor(
		private readonly http: HttpClient,
		private readonly repositoryId: string,
		private readonly transactionId: string,
	) {}

	private get basePath(): string {
		return `/repositories/${this.repositoryId}/transactions/${this.transactionId}`;
	}

	/** Get the transaction ID */
	get id(): string {
		return this.transactionId;
	}

	/** Check if transaction is still active */
	get isActive(): boolean {
		return this.active;
	}

	/** Execute a SPARQL query within the transaction */
	async query(sparql: string, options?: QueryOptions): Promise<SparqlBindings> {
		this.ensureActive();
		return this.http.post<SparqlBindings>(this.basePath, {
			body: sparql,
			contentType: ContentTypes.SPARQL_QUERY,
			params: {
				action: "QUERY",
				infer: options?.infer,
			},
			accept: ContentTypes.SPARQL_RESULTS_JSON,
			timeout: options?.timeout,
		});
	}

	/** Execute a SPARQL update within the transaction */
	async update(sparql: string, options?: { timeout?: number }): Promise<void> {
		this.ensureActive();
		await this.http.post<void>(this.basePath, {
			body: sparql,
			contentType: ContentTypes.SPARQL_UPDATE,
			params: { action: "UPDATE" },
			timeout: options?.timeout,
		});
	}

	/** Add RDF statements within the transaction */
	async add(
		data: string,
		options: {
			contentType: string;
			context?: string;
			baseURI?: string;
		},
	): Promise<void> {
		this.ensureActive();
		await this.http.put<void>(this.basePath, {
			body: data,
			contentType: options.contentType,
			params: {
				action: "ADD",
				context: options.context,
				baseURI: options.baseURI,
			},
		});
	}

	/** Delete statements within the transaction */
	async delete(options?: StatementOptions): Promise<void> {
		this.ensureActive();
		await this.http.post<void>(this.basePath, {
			params: {
				action: "DELETE",
				subj: options?.subj,
				pred: options?.pred,
				obj: options?.obj,
				context: Array.isArray(options?.context)
					? options?.context.join(",")
					: options?.context,
			},
		});
	}

	/** Get statements within the transaction */
	async getStatements(
		options?: StatementOptions & { accept?: string },
	): Promise<string> {
		this.ensureActive();
		return this.http.post<string>(this.basePath, {
			params: {
				action: "GET",
				subj: options?.subj,
				pred: options?.pred,
				obj: options?.obj,
				context: Array.isArray(options?.context)
					? options?.context.join(",")
					: options?.context,
				infer: options?.infer,
			},
			accept: options?.accept ?? ContentTypes.TURTLE,
		});
	}

	/** Get size within the transaction */
	async size(context?: string): Promise<number> {
		this.ensureActive();
		const result = await this.http.post<string>(this.basePath, {
			params: {
				action: "SIZE",
				context,
			},
			accept: ContentTypes.TEXT,
		});
		return parseInt(result, 10);
	}

	/** Commit the transaction */
	async commit(): Promise<void> {
		this.ensureActive();
		await this.http.put<void>(this.basePath, {
			params: { action: "COMMIT" },
		});
		this.active = false;
	}

	/** Rollback the transaction */
	async rollback(): Promise<void> {
		this.ensureActive();
		await this.http.delete<void>(this.basePath);
		this.active = false;
	}

	/** Ping to keep transaction alive */
	async ping(): Promise<void> {
		this.ensureActive();
		await this.http.post<void>(this.basePath, {
			params: { action: "PING" },
		});
	}

	private ensureActive(): void {
		if (!this.active) {
			throw new Error("Transaction is no longer active");
		}
	}
}
