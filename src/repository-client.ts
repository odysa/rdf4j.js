import { GraphStoreClient } from "./graph-store-client.ts";
import type { HttpClient } from "./http-client.ts";
import { TransactionClient } from "./transaction-client.ts";
import { ContentTypes, type IsolationLevel } from "./types.ts";

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

/** Query options for SPARQL queries */
export interface QueryOptions {
	/** Include inferred statements (default: true) */
	infer?: boolean;
	/** Query timeout in milliseconds */
	timeout?: number;
	/** Default graph URIs */
	defaultGraphUri?: string | string[];
	/** Named graph URIs */
	namedGraphUri?: string | string[];
	/** Variable bindings (prefix with $) */
	bindings?: Record<string, string>;
	/** Distinct results */
	distinct?: boolean;
	/** Limit number of results */
	limit?: number;
	/** Offset for pagination */
	offset?: number;
}

/** Options for statement operations */
export interface StatementOptions {
	/** Subject filter (N-Triples encoded) */
	subj?: string;
	/** Predicate filter (N-Triples encoded) */
	pred?: string;
	/** Object filter (N-Triples encoded) */
	obj?: string;
	/** Context/graph filter */
	context?: string | string[];
	/** Include inferred statements */
	infer?: boolean;
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

	// ============================================
	// Repository Configuration
	// ============================================

	/** Get repository configuration */
	async getConfig(): Promise<string> {
		return this.http.get<string>(`${this.basePath}/config`, {
			accept: ContentTypes.TURTLE,
		});
	}

	// ============================================
	// SPARQL Query Operations
	// ============================================

	/** Execute a SPARQL SELECT or CONSTRUCT query */
	async query(sparql: string, options?: QueryOptions): Promise<SparqlBindings> {
		const params = this.buildQueryParams(sparql, options);
		return this.http.get<SparqlBindings>(this.basePath, {
			params,
			accept: ContentTypes.SPARQL_RESULTS_JSON,
			timeout: options?.timeout,
		});
	}

	/** Execute a SPARQL SELECT query via POST (for large queries) */
	async queryPost(
		sparql: string,
		options?: QueryOptions,
	): Promise<SparqlBindings> {
		const params = this.buildQueryParams(sparql, options);
		// Remove query from params as it goes in body
		const { query: _, ...restParams } = params;

		return this.http.post<SparqlBindings>(this.basePath, {
			body: sparql,
			contentType: ContentTypes.SPARQL_QUERY,
			params: restParams,
			accept: ContentTypes.SPARQL_RESULTS_JSON,
			timeout: options?.timeout,
		});
	}

	/** Execute a SPARQL CONSTRUCT query and get RDF */
	async construct(
		sparql: string,
		options?: QueryOptions & { accept?: string },
	): Promise<string> {
		const params = this.buildQueryParams(sparql, options);
		return this.http.get<string>(this.basePath, {
			params,
			accept: options?.accept ?? ContentTypes.TURTLE,
			timeout: options?.timeout,
		});
	}

	/** Execute a SPARQL DESCRIBE query */
	async describe(
		resource: string,
		options?: { accept?: string },
	): Promise<string> {
		const sparql = `DESCRIBE <${resource}>`;
		return this.http.get<string>(this.basePath, {
			params: { query: sparql },
			accept: options?.accept ?? ContentTypes.TURTLE,
		});
	}

	/** Execute a SPARQL ASK query */
	async ask(sparql: string, options?: QueryOptions): Promise<boolean> {
		const params = this.buildQueryParams(sparql, options);
		const result = await this.http.get<SparqlBooleanResult>(this.basePath, {
			params,
			accept: ContentTypes.SPARQL_RESULTS_JSON,
			timeout: options?.timeout,
		});
		return result.boolean;
	}

	/** Build query parameters from options */
	private buildQueryParams(
		query: string,
		options?: QueryOptions,
	): Record<string, string | number | boolean | undefined> {
		const params: Record<string, string | number | boolean | undefined> = {
			query,
			queryLn: "sparql",
			infer: options?.infer,
			distinct: options?.distinct,
			limit: options?.limit,
			offset: options?.offset,
		};

		// Add default graph URIs
		if (options?.defaultGraphUri) {
			const graphs = Array.isArray(options.defaultGraphUri)
				? options.defaultGraphUri
				: [options.defaultGraphUri];
			graphs.forEach((uri, i) => {
				params[`default-graph-uri${i > 0 ? i : ""}`] = uri;
			});
		}

		// Add named graph URIs
		if (options?.namedGraphUri) {
			const graphs = Array.isArray(options.namedGraphUri)
				? options.namedGraphUri
				: [options.namedGraphUri];
			graphs.forEach((uri, i) => {
				params[`named-graph-uri${i > 0 ? i : ""}`] = uri;
			});
		}

		// Add variable bindings
		if (options?.bindings) {
			for (const [key, value] of Object.entries(options.bindings)) {
				const bindingKey = key.startsWith("$") ? key : `$${key}`;
				params[bindingKey] = value;
			}
		}

		return params;
	}

	// ============================================
	// SPARQL Update Operations
	// ============================================

	/** Execute a SPARQL UPDATE query */
	async update(sparql: string, options?: { timeout?: number }): Promise<void> {
		await this.http.post<void>(`${this.basePath}/statements`, {
			body: sparql,
			contentType: ContentTypes.SPARQL_UPDATE,
			timeout: options?.timeout,
		});
	}

	/** Execute a SPARQL UPDATE query with using graphs */
	async updateWithGraphs(
		sparql: string,
		options?: {
			usingGraphUri?: string | string[];
			usingNamedGraphUri?: string | string[];
			removeGraphUri?: string;
			insertGraphUri?: string;
			timeout?: number;
		},
	): Promise<void> {
		const params: Record<string, string | undefined> = {
			"remove-graph-uri": options?.removeGraphUri,
			"insert-graph-uri": options?.insertGraphUri,
		};

		// Add using graph URIs
		if (options?.usingGraphUri) {
			const graphs = Array.isArray(options.usingGraphUri)
				? options.usingGraphUri
				: [options.usingGraphUri];
			graphs.forEach((uri, i) => {
				params[`using-graph-uri${i > 0 ? i : ""}`] = uri;
			});
		}

		// Add using named graph URIs
		if (options?.usingNamedGraphUri) {
			const graphs = Array.isArray(options.usingNamedGraphUri)
				? options.usingNamedGraphUri
				: [options.usingNamedGraphUri];
			graphs.forEach((uri, i) => {
				params[`using-named-graph-uri${i > 0 ? i : ""}`] = uri;
			});
		}

		await this.http.post<void>(`${this.basePath}/statements`, {
			body: sparql,
			contentType: ContentTypes.SPARQL_UPDATE,
			params,
			timeout: options?.timeout,
		});
	}

	// ============================================
	// Statement Operations
	// ============================================

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

	/** Replace all statements (optionally in a context) */
	async replace(
		data: string,
		options: {
			contentType: string;
			context?: string;
			baseURI?: string;
		},
	): Promise<void> {
		await this.http.put<void>(`${this.basePath}/statements`, {
			body: data,
			contentType: options.contentType,
			params: {
				context: options.context,
				baseURI: options.baseURI,
			},
		});
	}

	/** Get statements matching a pattern */
	async getStatements(
		options?: StatementOptions & { accept?: string },
	): Promise<string> {
		return this.http.get<string>(`${this.basePath}/statements`, {
			accept: options?.accept ?? ContentTypes.TURTLE,
			params: {
				subj: options?.subj,
				pred: options?.pred,
				obj: options?.obj,
				context: Array.isArray(options?.context)
					? options?.context.join(",")
					: options?.context,
				infer: options?.infer,
			},
		});
	}

	/** Delete statements matching a pattern */
	async delete(options?: StatementOptions): Promise<void> {
		await this.http.delete<void>(`${this.basePath}/statements`, {
			params: {
				subj: options?.subj,
				pred: options?.pred,
				obj: options?.obj,
				context: Array.isArray(options?.context)
					? options?.context.join(",")
					: options?.context,
			},
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

	// ============================================
	// Size and Contexts
	// ============================================

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

	// ============================================
	// Namespace Operations
	// ============================================

	/** Get all namespaces */
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

	/** Get a specific namespace by prefix */
	async getNamespace(prefix: string): Promise<string | null> {
		try {
			return await this.http.get<string>(
				`${this.basePath}/namespaces/${prefix}`,
				{
					accept: ContentTypes.TEXT,
				},
			);
		} catch {
			return null;
		}
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

	/** Clear all namespaces */
	async clearNamespaces(): Promise<void> {
		await this.http.delete<void>(`${this.basePath}/namespaces`);
	}

	// ============================================
	// Clear Operations
	// ============================================

	/** Clear all statements (optionally in a specific context) */
	async clear(context?: string): Promise<void> {
		await this.http.delete<void>(`${this.basePath}/statements`, {
			params: { context },
		});
	}

	// ============================================
	// Transaction Operations
	// ============================================

	/** Start a new transaction */
	async beginTransaction(
		isolationLevel?: IsolationLevel,
	): Promise<TransactionClient> {
		const response = await this.http.requestWithHeaders(
			"POST",
			`${this.basePath}/transactions`,
			{
				params: isolationLevel
					? { "isolation-level": isolationLevel }
					: undefined,
				accept: ContentTypes.TEXT,
			},
		);

		// Extract transaction ID from Location header
		const location = response.headers.get("location") ?? "";
		const txnId = location.split("/").pop() ?? "";

		if (!txnId) {
			throw new Error("Failed to get transaction ID from response");
		}

		return new TransactionClient(this.http, this.repositoryId, txnId);
	}

	// ============================================
	// Graph Store Protocol (SPARQL 1.1 GSP)
	// ============================================

	/** Get the Graph Store client for this repository */
	graphStore(): GraphStoreClient {
		return new GraphStoreClient(this.http, this.repositoryId);
	}
}
