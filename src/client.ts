import { HttpClient } from "./http-client.ts";
import { ContentTypes, type RDF4JConfig } from "./types.ts";

/** RDF4J repository information */
export interface Repository {
	id: string;
	title: string;
	uri: string;
	readable: boolean;
	writable: boolean;
}

/** SPARQL query result bindings */
export interface SparqlBindings {
	head: {
		vars: string[];
	};
	results: {
		bindings: Array<
			Record<
				string,
				{
					type: "uri" | "literal" | "bnode";
					value: string;
					datatype?: string;
					"xml:lang"?: string;
				}
			>
		>;
	};
}

/** SPARQL boolean result */
export interface SparqlBooleanResult {
	head: Record<string, never>;
	boolean: boolean;
}

/** RDF4J REST API client */
export class RDF4JClient {
	private readonly http: HttpClient;

	constructor(config: RDF4JConfig) {
		this.http = new HttpClient(config);
	}

	/** Get the underlying HTTP client for custom requests */
	get httpClient(): HttpClient {
		return this.http;
	}

	/** Get server protocol version */
	async getProtocol(): Promise<string> {
		return this.http.get<string>("/protocol", {
			accept: ContentTypes.TEXT,
		});
	}

	/** List all repositories */
	async listRepositories(): Promise<Repository[]> {
		const result = await this.http.get<SparqlBindings>("/repositories", {
			accept: ContentTypes.SPARQL_RESULTS_JSON,
		});

		return result.results.bindings.map((binding) => ({
			id: binding.id?.value ?? "",
			title: binding.title?.value ?? "",
			uri: binding.uri?.value ?? "",
			readable: binding.readable?.value === "true",
			writable: binding.writable?.value === "true",
		}));
	}

	/** Get repository-specific client */
	repository(repositoryId: string): RepositoryClient {
		return new RepositoryClient(this.http, repositoryId);
	}
}

/** Client for repository-specific operations */
export class RepositoryClient {
	constructor(
		private readonly http: HttpClient,
		private readonly repositoryId: string,
	) {}

	private get basePath(): string {
		return `/repositories/${this.repositoryId}`;
	}

	/** Execute a SPARQL SELECT or CONSTRUCT query */
	async query(
		sparql: string,
		options?: { infer?: boolean; timeout?: number },
	): Promise<SparqlBindings> {
		return this.http.get<SparqlBindings>(this.basePath, {
			params: {
				query: sparql,
				infer: options?.infer,
				queryLn: "sparql",
			},
			accept: ContentTypes.SPARQL_RESULTS_JSON,
			timeout: options?.timeout,
		});
	}

	/** Execute a SPARQL ASK query */
	async ask(
		sparql: string,
		options?: { infer?: boolean; timeout?: number },
	): Promise<boolean> {
		const result = await this.http.get<SparqlBooleanResult>(this.basePath, {
			params: {
				query: sparql,
				infer: options?.infer,
				queryLn: "sparql",
			},
			accept: ContentTypes.SPARQL_RESULTS_JSON,
			timeout: options?.timeout,
		});
		return result.boolean;
	}

	/** Execute a SPARQL UPDATE query */
	async update(sparql: string, options?: { timeout?: number }): Promise<void> {
		await this.http.post<void>(`${this.basePath}/statements`, {
			body: sparql,
			contentType: ContentTypes.SPARQL_UPDATE,
			timeout: options?.timeout,
		});
	}

	/** Add RDF statements */
	async add(
		data: string,
		options: {
			contentType: string;
			context?: string;
			baseURI?: string;
		},
	): Promise<void> {
		await this.http.post<void>(`${this.basePath}/statements`, {
			body: data,
			contentType: options.contentType,
			params: {
				context: options.context,
				baseURI: options.baseURI,
			},
		});
	}

	/** Delete statements matching a pattern */
	async delete(options?: {
		subj?: string;
		pred?: string;
		obj?: string;
		context?: string;
	}): Promise<void> {
		await this.http.delete<void>(`${this.basePath}/statements`, {
			params: options,
		});
	}

	/** Export all statements */
	async export(options?: {
		accept?: string;
		context?: string;
	}): Promise<string> {
		return this.http.get<string>(`${this.basePath}/statements`, {
			accept: options?.accept ?? ContentTypes.TURTLE,
			params: {
				context: options?.context,
			},
		});
	}

	/** Get repository size (number of statements) */
	async size(context?: string): Promise<number> {
		const result = await this.http.get<string>(`${this.basePath}/size`, {
			params: { context },
			accept: ContentTypes.TEXT,
		});
		return parseInt(result, 10);
	}

	/** Get available contexts (named graphs) */
	async contexts(): Promise<string[]> {
		const result = await this.http.get<SparqlBindings>(
			`${this.basePath}/contexts`,
			{
				accept: ContentTypes.SPARQL_RESULTS_JSON,
			},
		);
		return result.results.bindings.map(
			(binding) => binding.contextID?.value ?? "",
		);
	}

	/** Get namespaces */
	async namespaces(): Promise<Record<string, string>> {
		const result = await this.http.get<SparqlBindings>(
			`${this.basePath}/namespaces`,
			{
				accept: ContentTypes.SPARQL_RESULTS_JSON,
			},
		);

		const namespaces: Record<string, string> = {};
		for (const binding of result.results.bindings) {
			const prefix = binding.prefix?.value;
			const namespace = binding.namespace?.value;
			if (prefix && namespace) {
				namespaces[prefix] = namespace;
			}
		}
		return namespaces;
	}

	/** Set a namespace prefix */
	async setNamespace(prefix: string, namespace: string): Promise<void> {
		await this.http.put<void>(`${this.basePath}/namespaces/${prefix}`, {
			body: namespace,
			contentType: ContentTypes.TEXT,
		});
	}

	/** Delete a namespace prefix */
	async deleteNamespace(prefix: string): Promise<void> {
		await this.http.delete<void>(`${this.basePath}/namespaces/${prefix}`);
	}

	/** Clear all statements (optionally in a specific context) */
	async clear(context?: string): Promise<void> {
		await this.http.delete<void>(`${this.basePath}/statements`, {
			params: { context },
		});
	}
}
