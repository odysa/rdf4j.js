import { HttpClient } from "./http-client.ts";
import type { SparqlBindings } from "./repository-client.ts";
import { RepositoryClient } from "./repository-client.ts";
import {
	ContentTypes,
	type RDF4JConfig,
	type RepositoryConfig,
} from "./types.ts";

/** RDF4J repository information */
export interface Repository {
	id: string;
	title: string;
	uri: string;
	readable: boolean;
	writable: boolean;
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

	/**
	 * Create a new repository
	 * @param config Repository configuration
	 */
	async createRepository(config: RepositoryConfig): Promise<void> {
		const configTurtle =
			config.configTurtle ?? this.generateDefaultConfig(config);
		await this.http.put<void>(`/repositories/${config.id}`, {
			body: configTurtle,
			contentType: ContentTypes.TURTLE,
		});
	}

	/**
	 * Delete a repository
	 * @param repositoryId Repository ID to delete
	 */
	async deleteRepository(repositoryId: string): Promise<void> {
		await this.http.delete<void>(`/repositories/${repositoryId}`);
	}

	/**
	 * Check if a repository exists
	 * @param repositoryId Repository ID to check
	 */
	async repositoryExists(repositoryId: string): Promise<boolean> {
		try {
			await this.http.head(`/repositories/${repositoryId}`);
			return true;
		} catch {
			return false;
		}
	}

	/** Get repository-specific client */
	repository(repositoryId: string): RepositoryClient {
		return new RepositoryClient(this.http, repositoryId);
	}

	/** Generate default repository configuration in Turtle format */
	private generateDefaultConfig(config: RepositoryConfig): string {
		const type = config.type ?? "memory";
		const title = config.title ?? config.id;

		// Generate repository config based on type
		const typeMap: Record<string, { impl: string; sailType?: string }> = {
			memory: {
				impl: "openrdf:SailRepository",
				sailType: "openrdf:MemoryStore",
			},
			native: {
				impl: "openrdf:SailRepository",
				sailType: "openrdf:NativeStore",
			},
			"memory-rdfs": {
				impl: "openrdf:SailRepository",
				sailType: "openrdf:ForwardChainingRDFSInferencer",
			},
			"native-rdfs": {
				impl: "openrdf:SailRepository",
				sailType: "openrdf:ForwardChainingRDFSInferencer",
			},
			sparql: { impl: "openrdf:SPARQLRepository" },
			remote: { impl: "openrdf:HTTPRepository" },
		};

		const defaultConfig = {
			impl: "openrdf:SailRepository",
			sailType: "openrdf:MemoryStore",
		};
		const typeConfig = typeMap[type] ?? defaultConfig;

		let turtle = `
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>.
@prefix rep: <http://www.openrdf.org/config/repository#>.
@prefix sr: <http://www.openrdf.org/config/repository/sail#>.
@prefix sail: <http://www.openrdf.org/config/sail#>.
@prefix ms: <http://www.openrdf.org/config/sail/memory#>.
@prefix ns: <http://www.openrdf.org/config/sail/native#>.

[] a rep:Repository ;
   rep:repositoryID "${config.id}" ;
   rdfs:label "${title}" ;
   rep:repositoryImpl [
      rep:repositoryType "${typeConfig.impl}"`;

		if (typeConfig.sailType) {
			turtle += ` ;
      sr:sailImpl [
         sail:sailType "${typeConfig.sailType}"
      ]`;
		}

		turtle += `
   ] .
`;
		return turtle;
	}
}
