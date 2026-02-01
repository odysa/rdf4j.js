import type { HttpClient } from "./http-client.ts";
import { ContentTypes } from "./types.ts";

/** Client for SPARQL 1.1 Graph Store Protocol operations */
export class GraphStoreClient {
	constructor(
		private readonly http: HttpClient,
		private readonly repositoryId: string,
	) {}

	private get basePath(): string {
		return `/repositories/${this.repositoryId}/rdf-graphs`;
	}

	/** Service URL for default graph (uses ?default without value per SPARQL GSP spec) */
	private get defaultGraphUrl(): string {
		return `${this.basePath}/service?default`;
	}

	/**
	 * Get the default graph
	 */
	async getDefault(accept?: string): Promise<string> {
		return this.http.get<string>(this.defaultGraphUrl, {
			accept: accept ?? ContentTypes.TURTLE,
		});
	}

	/**
	 * Replace the default graph
	 */
	async putDefault(data: string, contentType: string): Promise<void> {
		await this.http.put<void>(this.defaultGraphUrl, {
			body: data,
			contentType,
		});
	}

	/**
	 * Add to the default graph
	 */
	async postDefault(data: string, contentType: string): Promise<void> {
		await this.http.post<void>(this.defaultGraphUrl, {
			body: data,
			contentType,
		});
	}

	/**
	 * Delete the default graph
	 */
	async deleteDefault(): Promise<void> {
		await this.http.delete<void>(this.defaultGraphUrl);
	}

	/**
	 * Get a named graph (indirect reference)
	 */
	async get(graphUri: string, accept?: string): Promise<string> {
		return this.http.get<string>(`${this.basePath}/service`, {
			params: { graph: graphUri },
			accept: accept ?? ContentTypes.TURTLE,
		});
	}

	/**
	 * Replace a named graph (indirect reference)
	 */
	async put(
		graphUri: string,
		data: string,
		contentType: string,
	): Promise<void> {
		await this.http.put<void>(`${this.basePath}/service`, {
			body: data,
			contentType,
			params: { graph: graphUri },
		});
	}

	/**
	 * Add to a named graph (indirect reference)
	 */
	async post(
		graphUri: string,
		data: string,
		contentType: string,
	): Promise<void> {
		await this.http.post<void>(`${this.basePath}/service`, {
			body: data,
			contentType,
			params: { graph: graphUri },
		});
	}

	/**
	 * Delete a named graph (indirect reference)
	 */
	async delete(graphUri: string): Promise<void> {
		await this.http.delete<void>(`${this.basePath}/service`, {
			params: { graph: graphUri },
		});
	}

	/**
	 * Get a directly referenced named graph
	 */
	async getDirect(graphName: string, accept?: string): Promise<string> {
		return this.http.get<string>(
			`${this.basePath}/${encodeURIComponent(graphName)}`,
			{
				accept: accept ?? ContentTypes.TURTLE,
			},
		);
	}

	/**
	 * Replace a directly referenced named graph
	 */
	async putDirect(
		graphName: string,
		data: string,
		contentType: string,
	): Promise<void> {
		await this.http.put<void>(
			`${this.basePath}/${encodeURIComponent(graphName)}`,
			{
				body: data,
				contentType,
			},
		);
	}

	/**
	 * Add to a directly referenced named graph
	 */
	async postDirect(
		graphName: string,
		data: string,
		contentType: string,
	): Promise<void> {
		await this.http.post<void>(
			`${this.basePath}/${encodeURIComponent(graphName)}`,
			{
				body: data,
				contentType,
			},
		);
	}

	/**
	 * Delete a directly referenced named graph
	 */
	async deleteDirect(graphName: string): Promise<void> {
		await this.http.delete<void>(
			`${this.basePath}/${encodeURIComponent(graphName)}`,
		);
	}

	/**
	 * Check if a named graph exists
	 */
	async exists(graphUri: string): Promise<boolean> {
		try {
			await this.http.head(`${this.basePath}/service`, {
				params: { graph: graphUri },
			});
			return true;
		} catch {
			return false;
		}
	}
}
