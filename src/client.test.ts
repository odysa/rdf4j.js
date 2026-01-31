import { afterEach, beforeEach, expect, type Mock, mock, test } from "bun:test";
import { RDF4JClient, type SparqlBindings } from "./client.ts";
import { ContentTypes } from "./types.ts";

let mockFetchFn: Mock<
	(url: string | URL | Request, init?: RequestInit) => Promise<Response>
>;
const originalFetch = globalThis.fetch;

function setMockFetch(response: unknown, contentType = "application/json") {
	mockFetchFn = mock(() =>
		Promise.resolve(
			new Response(
				typeof response === "string" ? response : JSON.stringify(response),
				{
					status: 200,
					headers: { "content-type": contentType },
				},
			),
		),
	);
	globalThis.fetch = mockFetchFn as unknown as typeof fetch;
}

beforeEach(() => {
	setMockFetch({ test: "data" });
});

afterEach(() => {
	globalThis.fetch = originalFetch;
});

test("RDF4JClient.getProtocol returns protocol version", async () => {
	setMockFetch("10", "text/plain");

	const client = new RDF4JClient({ baseUrl: "http://localhost:8080/rdf4j" });
	const protocol = await client.getProtocol();

	expect(protocol).toBe("10");
});

test("RDF4JClient.listRepositories parses SPARQL results", async () => {
	setMockFetch({
		head: { vars: ["id", "title", "uri", "readable", "writable"] },
		results: {
			bindings: [
				{
					id: { type: "literal", value: "test-repo" },
					title: { type: "literal", value: "Test Repository" },
					uri: {
						type: "uri",
						value: "http://localhost:8080/rdf4j/repositories/test-repo",
					},
					readable: { type: "literal", value: "true" },
					writable: { type: "literal", value: "true" },
				},
				{
					id: { type: "literal", value: "readonly" },
					title: { type: "literal", value: "Read Only Repo" },
					uri: {
						type: "uri",
						value: "http://localhost:8080/rdf4j/repositories/readonly",
					},
					readable: { type: "literal", value: "true" },
					writable: { type: "literal", value: "false" },
				},
			],
		},
	});

	const client = new RDF4JClient({ baseUrl: "http://localhost:8080/rdf4j" });
	const repos = await client.listRepositories();

	expect(repos).toHaveLength(2);
	expect(repos[0]).toEqual({
		id: "test-repo",
		title: "Test Repository",
		uri: "http://localhost:8080/rdf4j/repositories/test-repo",
		readable: true,
		writable: true,
	});
	expect(repos[1]?.writable).toBe(false);
});

test("RepositoryClient.query sends SPARQL query", async () => {
	const sparqlResult: SparqlBindings = {
		head: { vars: ["s", "p", "o"] },
		results: {
			bindings: [
				{
					s: { type: "uri", value: "http://example.org/s" },
					p: { type: "uri", value: "http://example.org/p" },
					o: { type: "literal", value: "test" },
				},
			],
		},
	};
	setMockFetch(sparqlResult);

	const client = new RDF4JClient({ baseUrl: "http://localhost:8080/rdf4j" });
	const repo = client.repository("test");
	const result = await repo.query("SELECT * WHERE { ?s ?p ?o }");

	expect(result).toEqual(sparqlResult);

	const calledUrl = mockFetchFn.mock.calls[0]?.[0] as string;
	expect(calledUrl).toContain("/repositories/test");
	expect(calledUrl).toContain("query=SELECT");
});

test("RepositoryClient.ask returns boolean", async () => {
	setMockFetch({ head: {}, boolean: true });

	const client = new RDF4JClient({ baseUrl: "http://localhost:8080/rdf4j" });
	const repo = client.repository("test");
	const result = await repo.ask("ASK { ?s ?p ?o }");

	expect(result).toBe(true);
});

test("RepositoryClient.update sends SPARQL update", async () => {
	mockFetchFn = mock(() =>
		Promise.resolve(new Response(null, { status: 204 })),
	);
	globalThis.fetch = mockFetchFn as unknown as typeof fetch;

	const client = new RDF4JClient({ baseUrl: "http://localhost:8080/rdf4j" });
	const repo = client.repository("test");
	await repo.update("INSERT DATA { <http://s> <http://p> <http://o> }");

	const options = mockFetchFn.mock.calls[0]?.[1] as RequestInit;
	expect(options.method).toBe("POST");
	expect((options.headers as Record<string, string>)["Content-Type"]).toBe(
		ContentTypes.SPARQL_UPDATE,
	);
});

test("RepositoryClient.add sends RDF data", async () => {
	mockFetchFn = mock(() =>
		Promise.resolve(new Response(null, { status: 204 })),
	);
	globalThis.fetch = mockFetchFn as unknown as typeof fetch;

	const client = new RDF4JClient({ baseUrl: "http://localhost:8080/rdf4j" });
	const repo = client.repository("test");
	const turtle = "<http://s> <http://p> <http://o> .";
	await repo.add(turtle, { contentType: ContentTypes.TURTLE });

	const options = mockFetchFn.mock.calls[0]?.[1] as RequestInit;
	expect(options.method).toBe("POST");
	expect((options.headers as Record<string, string>)["Content-Type"]).toBe(
		ContentTypes.TURTLE,
	);
	expect(options.body).toBe(turtle);
});

test("RepositoryClient.size returns statement count", async () => {
	setMockFetch("12345", "text/plain");

	const client = new RDF4JClient({ baseUrl: "http://localhost:8080/rdf4j" });
	const repo = client.repository("test");
	const size = await repo.size();

	expect(size).toBe(12345);
});

test("RepositoryClient.contexts returns named graphs", async () => {
	setMockFetch({
		head: { vars: ["contextID"] },
		results: {
			bindings: [
				{ contextID: { type: "uri", value: "http://example.org/graph1" } },
				{ contextID: { type: "uri", value: "http://example.org/graph2" } },
			],
		},
	});

	const client = new RDF4JClient({ baseUrl: "http://localhost:8080/rdf4j" });
	const repo = client.repository("test");
	const contexts = await repo.contexts();

	expect(contexts).toEqual([
		"http://example.org/graph1",
		"http://example.org/graph2",
	]);
});

test("RepositoryClient.namespaces returns prefix map", async () => {
	setMockFetch({
		head: { vars: ["prefix", "namespace"] },
		results: {
			bindings: [
				{
					prefix: { type: "literal", value: "rdf" },
					namespace: {
						type: "uri",
						value: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
					},
				},
				{
					prefix: { type: "literal", value: "rdfs" },
					namespace: {
						type: "uri",
						value: "http://www.w3.org/2000/01/rdf-schema#",
					},
				},
			],
		},
	});

	const client = new RDF4JClient({ baseUrl: "http://localhost:8080/rdf4j" });
	const repo = client.repository("test");
	const namespaces = await repo.namespaces();

	expect(namespaces).toEqual({
		rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
		rdfs: "http://www.w3.org/2000/01/rdf-schema#",
	});
});

test("RepositoryClient.export returns RDF statements", async () => {
	const turtle = `@prefix ex: <http://example.org/> .
ex:s ex:p ex:o .`;
	setMockFetch(turtle, "text/turtle");

	const client = new RDF4JClient({ baseUrl: "http://localhost:8080/rdf4j" });
	const repo = client.repository("test");
	const result = await repo.export({ accept: ContentTypes.TURTLE });

	expect(result).toBe(turtle);
});

test("RDF4JClient exposes httpClient for custom requests", () => {
	const client = new RDF4JClient({ baseUrl: "http://localhost:8080/rdf4j" });

	expect(client.httpClient).toBeDefined();
	expect(typeof client.httpClient.get).toBe("function");
});
