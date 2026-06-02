import axios from 'axios';

/**
 * Casino-agnostic GraphQL transport.
 * Returns a typed `gql` function bound to `endpoint`.
 */
export function makeGraphClient(endpoint: string) {
  return async function gql<T>(
    query: string,
    variables: Record<string, unknown> = {}
  ): Promise<T> {
    const res = await axios.post(
      endpoint,
      { query, variables },
      { headers: { 'Content-Type': 'application/json' }, timeout: 30_000 }
    );
    if (res.data.errors) {
      throw new Error(
        res.data.errors.map((e: { message: string }) => e.message).join('; ')
      );
    }
    return res.data.data as T;
  };
}

export function betSwirlEndpoint(apiKey: string, deploymentId: string): string {
  return `https://gateway.thegraph.com/api/${apiKey}/deployments/id/${deploymentId}`;
}
