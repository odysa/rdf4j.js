import {
	ContentTypes,
	type HttpMethod,
	type RDF4JConfig,
	RDF4JError,
	type RequestOptions,
} from "./types.ts";

/** Low-level HTTP client for making REST API calls */
export class HttpClient {
	private readonly baseUrl: string;
	private readonly defaultHeaders: Record<string, string>;
	private readonly timeout: number;

	constructor(config: RDF4JConfig) {
		this.baseUrl = config.baseUrl.replace(/\/$/, "");
		this.timeout = config.timeout ?? 30000;

		this.defaultHeaders = {
			...config.headers,
		};

		if (config.auth) {
			const credentials = btoa(
				`${config.auth.username}:${config.auth.password}`,
			);
			this.defaultHeaders.Authorization = `Basic ${credentials}`;
		}
	}

	/** Build full URL with query parameters */
	private buildUrl(
		path: string,
		params?: Record<string, string | number | boolean | undefined>,
	): string {
		const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
		const url = new URL(`${this.baseUrl}/${normalizedPath}`);

		if (params) {
			for (const [key, value] of Object.entries(params)) {
				if (value !== undefined) {
					url.searchParams.set(key, String(value));
				}
			}
		}

		return url.toString();
	}

	/** Prepare request body and content type */
	private prepareBody(options: RequestOptions): {
		body: string | undefined;
		contentType: string | undefined;
	} {
		if (!options.body) {
			return { body: undefined, contentType: undefined };
		}

		if (typeof options.body === "string") {
			return {
				body: options.body,
				contentType: options.contentType ?? ContentTypes.TEXT,
			};
		}

		return {
			body: JSON.stringify(options.body),
			contentType: options.contentType ?? ContentTypes.JSON,
		};
	}

	/** Make an HTTP request */
	async request<T = unknown>(
		method: HttpMethod,
		path: string,
		options: RequestOptions = {},
	): Promise<T> {
		const url = this.buildUrl(path, options.params);
		const { body, contentType } = this.prepareBody(options);

		const headers: Record<string, string> = {
			...this.defaultHeaders,
			...options.headers,
		};

		if (contentType) {
			headers["Content-Type"] = contentType;
		}

		if (options.accept) {
			headers.Accept = options.accept;
		}

		const controller = new AbortController();
		const timeoutId = setTimeout(
			() => controller.abort(),
			options.timeout ?? this.timeout,
		);

		try {
			const response = await fetch(url, {
				method,
				headers,
				body,
				signal: controller.signal,
			});

			if (!response.ok) {
				let errorResponse: unknown;
				try {
					const text = await response.text();
					errorResponse = text ? JSON.parse(text) : undefined;
				} catch {
					// Response body is not JSON
				}

				throw new RDF4JError(
					`HTTP ${response.status}: ${response.statusText}`,
					response.status,
					response.statusText,
					errorResponse as Record<string, unknown>,
				);
			}

			const responseContentType = response.headers.get("content-type") ?? "";

			if (response.status === 204 || !responseContentType) {
				return undefined as T;
			}

			if (
				responseContentType.includes("application/json") ||
				responseContentType.includes("+json")
			) {
				return (await response.json()) as T;
			}

			return (await response.text()) as T;
		} finally {
			clearTimeout(timeoutId);
		}
	}

	/** Make an HTTP request and return response with headers */
	async requestWithHeaders(
		method: HttpMethod,
		path: string,
		options: RequestOptions = {},
	): Promise<{ body: unknown; headers: Headers; status: number }> {
		const url = this.buildUrl(path, options.params);
		const { body, contentType } = this.prepareBody(options);

		const headers: Record<string, string> = {
			...this.defaultHeaders,
			...options.headers,
		};

		if (contentType) {
			headers["Content-Type"] = contentType;
		}

		if (options.accept) {
			headers.Accept = options.accept;
		}

		const controller = new AbortController();
		const timeoutId = setTimeout(
			() => controller.abort(),
			options.timeout ?? this.timeout,
		);

		try {
			const response = await fetch(url, {
				method,
				headers,
				body,
				signal: controller.signal,
			});

			if (!response.ok) {
				let errorResponse: unknown;
				try {
					const text = await response.text();
					errorResponse = text ? JSON.parse(text) : undefined;
				} catch {
					// Response body is not JSON
				}

				throw new RDF4JError(
					`HTTP ${response.status}: ${response.statusText}`,
					response.status,
					response.statusText,
					errorResponse as Record<string, unknown>,
				);
			}

			const responseContentType = response.headers.get("content-type") ?? "";

			let responseBody: unknown;
			if (response.status === 204 || !responseContentType) {
				responseBody = undefined;
			} else if (
				responseContentType.includes("application/json") ||
				responseContentType.includes("+json")
			) {
				responseBody = await response.json();
			} else {
				responseBody = await response.text();
			}

			return {
				body: responseBody,
				headers: response.headers,
				status: response.status,
			};
		} finally {
			clearTimeout(timeoutId);
		}
	}

	/** GET request */
	get<T = unknown>(path: string, options?: RequestOptions): Promise<T> {
		return this.request<T>("GET", path, options);
	}

	/** POST request */
	post<T = unknown>(path: string, options?: RequestOptions): Promise<T> {
		return this.request<T>("POST", path, options);
	}

	/** PUT request */
	put<T = unknown>(path: string, options?: RequestOptions): Promise<T> {
		return this.request<T>("PUT", path, options);
	}

	/** DELETE request */
	delete<T = unknown>(path: string, options?: RequestOptions): Promise<T> {
		return this.request<T>("DELETE", path, options);
	}

	/** HEAD request */
	head(path: string, options?: RequestOptions): Promise<void> {
		return this.request<void>("HEAD", path, options);
	}
}
