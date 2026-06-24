import http from "http";

interface HttpRequestMatcher {
  readonly method: string;
  readonly path: string;
  readonly queryStringParameters?: Record<string, string[]>;
}

interface HttpResponseMock {
  readonly body: string;
  readonly headers?: Record<string, string[]>;
  readonly statusCode: number;
}

interface MockInteraction {
  readonly httpRequest: HttpRequestMatcher;
  readonly httpResponse: HttpResponseMock;
}

interface ReceivedRequest {
  readonly method: string;
  readonly path: string;
  readonly queryStringParameters: Record<string, string[]>;
}

export interface HttpMockServerHarness {
  readonly apiHost: string;
  readonly mockAnyResponse: (interaction: MockInteraction) => Promise<void>;
  readonly reset: () => Promise<void>;
  readonly verify: (
    matcher: HttpRequestMatcher,
    min: number,
    max: number
  ) => Promise<void>;
  readonly verifyZeroInteractions: () => Promise<void>;
  readonly stop: () => Promise<void>;
}

export async function startHttpMockServer(): Promise<HttpMockServerHarness> {
  const expectations: MockInteraction[] = [];
  const received: ReceivedRequest[] = [];

  const server = http.createServer((req, res) => {
    const method = req.method ?? "GET";
    const [path, query = ""] = (req.url ?? "/").split("?");
    const queryStringParameters = toQueryStringParameters(query);

    received.push({ method, path, queryStringParameters });

    const match = expectations.find(({ httpRequest }) =>
      matches(httpRequest, { method, path, queryStringParameters })
    );

    if (match == null) {
      res.statusCode = 404;
      res.end("No mock response configured.");
      return;
    }

    const { body, headers = {}, statusCode } = match.httpResponse;
    Object.entries(headers).forEach(([name, values]) => {
      res.setHeader(name, values);
    });
    res.statusCode = statusCode;
    res.end(body);
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();
  if (address == null || typeof address === "string") {
    throw new Error("Mock server did not expose a numeric port.");
  }

  return {
    apiHost: `http://127.0.0.1:${address.port}`,
    mockAnyResponse: async (interaction) => {
      expectations.push(interaction);
    },
    reset: async () => {
      expectations.length = 0;
      received.length = 0;
    },
    verify: async (matcher, min, max) => {
      const count = received.filter((request) =>
        matches(matcher, request)
      ).length;
      if (count < min || count > max) {
        throw new Error(
          `Expected ${matcher.method} ${matcher.path} between ${min} and ${max} times, saw ${count}.`
        );
      }
    },
    verifyZeroInteractions: async () => {
      if (received.length !== 0) {
        throw new Error(
          `Expected zero mock server interactions, saw ${received.length}.`
        );
      }
    },
    stop: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}

function matches(
  expected: HttpRequestMatcher,
  actual: ReceivedRequest
): boolean {
  return (
    expected.method === actual.method &&
    expected.path === actual.path &&
    queryStringParametersMatch(
      expected.queryStringParameters ?? {},
      actual.queryStringParameters
    )
  );
}

function queryStringParametersMatch(
  expected: Record<string, string[]>,
  actual: Record<string, string[]>
): boolean {
  const expectedKeys = Object.keys(expected);
  const actualKeys = Object.keys(actual);
  if (expectedKeys.length !== actualKeys.length) return false;

  return expectedKeys.every((key) => {
    const expectedValues = expected[key] ?? [];
    const actualValues = actual[key] ?? [];
    return (
      expectedValues.length === actualValues.length &&
      expectedValues.every((value, index) => value === actualValues[index])
    );
  });
}

function toQueryStringParameters(query: string): Record<string, string[]> {
  const params = new URLSearchParams(query);
  const queryStringParameters: Record<string, string[]> = {};

  params.forEach((value, key) => {
    if (queryStringParameters[key] == null) {
      queryStringParameters[key] = [];
    }
    queryStringParameters[key].push(value);
  });

  return queryStringParameters;
}
