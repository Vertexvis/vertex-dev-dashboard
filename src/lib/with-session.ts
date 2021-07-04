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

const CookieName = "sess";
const CredsKey = "creds";
const TokenKey = "token";
const EnvKey = "env";
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

export function getCreds(session: Session): OAuthCredentials | undefined {
  return session.get(CredsKey);
}

export function getEnv(session: Session): Environment | undefined {
  return session.get(EnvKey);
}

export function getToken(session: Session): SessionToken | undefined {
  return session.get(TokenKey);
}

export function setCreds(session: Session, val: OAuthCredentials): void {
  session.set(CredsKey, val);
}

export function setEnv(session: Session, val: Environment): void {
  session.set(EnvKey, val);
}

export function setToken(session: Session, val: SessionToken): void {
  session.set(TokenKey, val);
}
