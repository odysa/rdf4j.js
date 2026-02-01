/** RDF4J client configuration */
export interface RDF4JConfig {
	/** Base URL of the RDF4J server (e.g., "http://localhost:8080/rdf4j-server") */
	baseUrl: string;
	/** Optional authentication credentials */
	auth?: {
		username: string;
		password: string;
	};
	/** Request timeout in milliseconds (default: 30000) */
	timeout?: number;
	/** Custom headers to include in all requests */
	headers?: Record<string, string>;
}

/** HTTP methods supported by the client */
export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "HEAD" | "PATCH";

/** Request options for individual API calls */
export interface RequestOptions {
	/** Additional headers for this request */
	headers?: Record<string, string>;
	/** Query parameters */
	params?: Record<string, string | number | boolean | undefined>;
	/** Request body */
	body?: string | object;
	/** Content type (defaults based on body type) */
	contentType?: string;
	/** Expected response type */
	accept?: string;
	/** Request timeout override */
	timeout?: number;
}

/** RDF4J API error response */
export interface RDF4JErrorResponse {
	message?: string;
	error?: string;
	status?: number;
}

/** Custom error class for RDF4J API errors */
export class RDF4JError extends Error {
	constructor(
		message: string,
		public readonly status: number,
		public readonly statusText: string,
		public readonly response?: RDF4JErrorResponse,
	) {
		super(message);
		this.name = "RDF4JError";
	}
}

/** Common RDF content types */
export const ContentTypes = {
	// RDF formats
	TURTLE: "text/turtle",
	NTRIPLES: "application/n-triples",
	NQUADS: "application/n-quads",
	RDFXML: "application/rdf+xml",
	JSONLD: "application/ld+json",
	TRIG: "application/trig",
	TRIX: "application/trix",
	BINARY_RDF: "application/x-binary-rdf",
	RDF_JSON: "application/rdf+json",
	N3: "text/rdf+n3",

	// SPARQL formats
	SPARQL_QUERY: "application/sparql-query",
	SPARQL_UPDATE: "application/sparql-update",
	SPARQL_RESULTS_JSON: "application/sparql-results+json",
	SPARQL_RESULTS_XML: "application/sparql-results+xml",
	BINARY_RDF_RESULTS: "application/x-binary-rdf-results-table",

	// Transaction format
	RDF_TRANSACTION: "application/x-rdftransaction",

	// Generic
	JSON: "application/json",
	FORM: "application/x-www-form-urlencoded",
	TEXT: "text/plain",
} as const;

export type ContentType = (typeof ContentTypes)[keyof typeof ContentTypes];

/** Transaction isolation levels */
export type IsolationLevel =
	| "NONE"
	| "READ_UNCOMMITTED"
	| "READ_COMMITTED"
	| "SNAPSHOT_READ"
	| "SNAPSHOT"
	| "SERIALIZABLE";

/** Repository configuration template types */
export type RepositoryType =
	| "memory"
	| "native"
	| "memory-rdfs"
	| "memory-rdfs-dt"
	| "native-rdfs"
	| "native-rdfs-dt"
	| "memory-shacl"
	| "native-shacl"
	| "memory-spin"
	| "native-spin"
	| "memory-lucene"
	| "native-lucene"
	| "memory-customrule"
	| "native-customrule"
	| "remote"
	| "sparql"
	| "federation";

/** Repository configuration */
export interface RepositoryConfig {
	id: string;
	title?: string;
	type?: RepositoryType | string;
	/** Additional configuration as RDF in Turtle format */
	configTurtle?: string;
}

/** Transaction action types for RDF transaction documents */
export type TransactionAction =
	| "ADD"
	| "DELETE"
	| "GET"
	| "QUERY"
	| "UPDATE"
	| "SIZE"
	| "COMMIT"
	| "ROLLBACK";
