import { OAuth2Token } from "@vertexvis/api-client-node";
import { Environment } from "@vertexvis/viewer";
import {
  GetServerSidePropsResult,
  NextApiRequest,
  NextApiResponse,
} from "next";
import {
  Handler,
  Session,
  SessionOptions,
  withIronSession,
} from "next-iron-session";

export interface CommonProps {
  readonly clientId: string;
  readonly vertexEnv: Environment;
}

export type SessionToken = {
  readonly token: OAuth2Token;
  readonly expiration: number;
};

export type OAuthCredentials = {
  readonly id: string;
  readonly secret: string;
};

export const CookieName = "sess";
export const CredsKey = "creds";
export const TokenKey = "token";
export const EnvKey = "env";
export const CookieAttributes: SessionOptions = {
  password: process.env.COOKIE_SECRET || "",
  cookieName: CookieName,
  cookieOptions: {
    // Allow session use in non-https environments like localhost
    secure: process.env.NODE_ENV === "production",
  },
};

export type NextIronRequest = NextApiRequest & { readonly session: Session };

export default function withSession(
  handler: Handler<NextIronRequest, NextApiResponse>
): Handler<NextApiRequest, NextApiResponse> {
  return withIronSession(handler, CookieAttributes);
}

export const defaultServerSideProps = withIronSession(
  serverSidePropsHandler,
  CookieAttributes
);

export function serverSidePropsHandler({
  req: { session },
}: {
  req: NextIronRequest;
}): GetServerSidePropsResult<CommonProps> {
  const token: SessionToken | undefined = session.get(TokenKey);
  const creds: OAuthCredentials | undefined = session.get(CredsKey);
  const vertexEnv: Environment = session.get(EnvKey) || "platdev";

  if (!session || !creds || !token) {
    return { redirect: { statusCode: 302, destination: "/login" } };
  }

  return { props: { clientId: creds.id, vertexEnv } };
}
