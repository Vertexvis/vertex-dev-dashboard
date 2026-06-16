import { MockserverContainer } from "@testcontainers/mockserver";
import type { StartedMockserverContainer } from "@testcontainers/mockserver";
import { mockServerClient } from "mockserver-client";
import type { MockServerClient } from "mockserver-client";

export interface MockServerHarness {
  readonly apiHost: string;
  readonly client: MockServerClient;
  readonly stop: () => Promise<void>;
}

export async function startMockServer(): Promise<MockServerHarness> {
  const container: StartedMockserverContainer =
    await new MockserverContainer().start();
  const apiHost = container.getUrl();

  return {
    apiHost,
    client: mockServerClient(
      container.getHost(),
      container.getMockserverPort()
    ),
    stop: async () => {
      await container.stop();
    },
  };
}
