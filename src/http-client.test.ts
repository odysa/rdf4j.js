import { afterEach, beforeEach, expect, type Mock, mock, test } from "bun:test";
import { HttpClient } from "./http-client.ts";
import { ContentTypes, RDF4JError } from "./types.ts";

let mockFetchFn: Mock<
	(url: string | URL | Request, init?: RequestInit) => Promise<Response>
>;
const originalFetch = globalThis.fetch;

beforeEach(() => {
	mockFetchFn = mock(() =>
		Promise.resolve(
			new Response(JSON.stringify({ test: "data" }), {
				status: 200,
				headers: { "content-type": "application/json" },
			}),
		),
	);
	globalThis.fetch = mockFetchFn as unknown as typeof fetch;
});

afterEach(() => {
	globalThis.fetch = originalFetch;
});

test("HttpClient constructs URL correctly", async () => {
	const client = new HttpClient({ baseUrl: "http://localhost:8080/rdf4j" });

	await client.get("/test");

	expect(mockFetchFn).toHaveBeenCalledWith(
		"http://localhost:8080/rdf4j/test",
		expect.any(Object),
	);
});

test("HttpClient strips trailing slash from baseUrl", async () => {
	const client = new HttpClient({
		baseUrl: "http://localhost:8080/rdf4j-server/",
	});

	await client.get("/repositories");

	expect(mockFetchFn).toHaveBeenCalledWith(
		"http://localhost:8080/rdf4j-server/repositories",
		expect.any(Object),
	);
});

test("HttpClient adds query parameters", async () => {
	const client = new HttpClient({ baseUrl: "http://localhost:8080" });

	await client.get("/test", {
		params: { query: "SELECT * WHERE { ?s ?p ?o }", limit: 10 },
	});

	const calledUrl = mockFetchFn.mock.calls[0]?.[0] as string;
	expect(calledUrl).toContain("query=SELECT");
	expect(calledUrl).toContain("limit=10");
});

test("HttpClient skips undefined params", async () => {
	const client = new HttpClient({ baseUrl: "http://localhost:8080" });

	await client.get("/test", {
		params: { query: "test", limit: undefined },
	});

	const calledUrl = mockFetchFn.mock.calls[0]?.[0] as string;
	expect(calledUrl).toContain("query=test");
	expect(calledUrl).not.toContain("limit");
});

test("HttpClient adds basic auth header", async () => {
	const client = new HttpClient({
		baseUrl: "http://localhost:8080",
		auth: { username: "admin", password: "secret" },
	});

	await client.get("/test");

	const options = mockFetchFn.mock.calls[0]?.[1] as RequestInit;
	const headers = options.headers as Record<string, string>;
	expect(headers.Authorization).toBe(`Basic ${btoa("admin:secret")}`);
});

test("HttpClient adds custom headers", async () => {
	const client = new HttpClient({
		baseUrl: "http://localhost:8080",
		headers: { "X-Custom": "value" },
	});

	await client.get("/test");

	const options = mockFetchFn.mock.calls[0]?.[1] as RequestInit;
	const headers = options.headers as Record<string, string>;
	expect(headers["X-Custom"]).toBe("value");
});

test("HttpClient sets Accept header", async () => {
	const client = new HttpClient({ baseUrl: "http://localhost:8080" });

	await client.get("/test", { accept: ContentTypes.TURTLE });

	const options = mockFetchFn.mock.calls[0]?.[1] as RequestInit;
	const headers = options.headers as Record<string, string>;
	expect(headers.Accept).toBe("text/turtle");
});

test("HttpClient sends JSON body", async () => {
	const client = new HttpClient({ baseUrl: "http://localhost:8080" });

	await client.post("/test", { body: { key: "value" } });

	const options = mockFetchFn.mock.calls[0]?.[1] as RequestInit;
	const headers = options.headers as Record<string, string>;
	expect(headers["Content-Type"]).toBe("application/json");
	expect(options.body).toBe(JSON.stringify({ key: "value" }));
});

test("HttpClient sends string body with custom content type", async () => {
	const client = new HttpClient({ baseUrl: "http://localhost:8080" });

	await client.post("/test", {
		body: "SELECT * WHERE { ?s ?p ?o }",
		contentType: ContentTypes.SPARQL_QUERY,
	});

	const options = mockFetchFn.mock.calls[0]?.[1] as RequestInit;
	const headers = options.headers as Record<string, string>;
	expect(headers["Content-Type"]).toBe("application/sparql-query");
	expect(options.body).toBe("SELECT * WHERE { ?s ?p ?o }");
});

test("HttpClient throws RDF4JError on non-ok response", async () => {
	mockFetchFn = mock(() =>
		Promise.resolve(
			new Response(JSON.stringify({ error: "Not found" }), {
				status: 404,
				statusText: "Not Found",
			}),
		),
	);
	globalThis.fetch = mockFetchFn as unknown as typeof fetch;

	const client = new HttpClient({ baseUrl: "http://localhost:8080" });

	try {
		await client.get("/missing");
		expect(true).toBe(false); // Should not reach here
	} catch (e) {
		expect(e).toBeInstanceOf(RDF4JError);
		const error = e as RDF4JError;
		expect(error.status).toBe(404);
		expect(error.statusText).toBe("Not Found");
		expect(error.message).toBe("HTTP 404: Not Found");
	}
});

test("HttpClient returns text for non-JSON response", async () => {
	mockFetchFn = mock(() =>
		Promise.resolve(
			new Response("plain text response", {
				status: 200,
				headers: { "content-type": "text/plain" },
			}),
		),
	);
	globalThis.fetch = mockFetchFn as unknown as typeof fetch;

	const client = new HttpClient({ baseUrl: "http://localhost:8080" });
	const result = await client.get<string>("/test");

	expect(result).toBe("plain text response");
});

test("HttpClient returns undefined for 204 response", async () => {
	mockFetchFn = mock(() =>
		Promise.resolve(new Response(null, { status: 204 })),
	);
	globalThis.fetch = mockFetchFn as unknown as typeof fetch;

	const client = new HttpClient({ baseUrl: "http://localhost:8080" });
	const result = await client.delete("/test");

	expect(result).toBeUndefined();
});

test("HttpClient uses correct HTTP methods", async () => {
	const client = new HttpClient({ baseUrl: "http://localhost:8080" });

	await client.get("/test");
	let options = mockFetchFn.mock.calls[0]?.[1] as RequestInit;
	expect(options.method).toBe("GET");

	await client.post("/test");
	options = mockFetchFn.mock.calls[1]?.[1] as RequestInit;
	expect(options.method).toBe("POST");

	await client.put("/test");
	options = mockFetchFn.mock.calls[2]?.[1] as RequestInit;
	expect(options.method).toBe("PUT");

	await client.delete("/test");
	options = mockFetchFn.mock.calls[3]?.[1] as RequestInit;
	expect(options.method).toBe("DELETE");

	await client.head("/test");
	options = mockFetchFn.mock.calls[4]?.[1] as RequestInit;
	expect(options.method).toBe("HEAD");
});
