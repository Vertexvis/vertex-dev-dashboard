// this file is a wrapper with defaults to be used in both API routes and `getServerSideProps` functions
import { OAuth2Token } from "@vertexvis/api-client-node";
import { Environment } from "@vertexvis/viewer";
import {
  GetServerSidePropsResult,
  NextApiRequest,
  NextApiResponse,
} from "next";
import { Handler, Session, withIronSession } from "next-iron-session";

import { Config } from "../lib/config";

export const COOKIE_ATTRIBURES = {
  password: process.env.COOKIE_SECRET || "",
  cookieName: "sess",
  cookieOptions: {
    // the next line allows to use the session in non-https environments like
    // Next.js dev mode (http://localhost:3000)
    secure: process.env.NODE_ENV === "production",
  },
};

export const CredsKey = "creds";
export const TokenKey = "token";

export type SessionToken = {
  readonly token: OAuth2Token;
  readonly expiration: number;
};

export type OAuthCredentials = {
  readonly id: string;
  readonly secret: string;
};

// optionally add stronger typing for next-specific implementation
export type NextIronRequest = NextApiRequest & { readonly session: Session };

const withSession = (
  handler: Handler<NextIronRequest, NextApiResponse>
): Handler<NextApiRequest, NextApiResponse> => {
  return withIronSession(handler, COOKIE_ATTRIBURES);
};

export default withSession;

export type CommonProps = {
  readonly clientId: string;
  readonly vertexEnv: Environment;
};

export const defaultSSP = withIronSession(
  serverSidePropsHandler,
  COOKIE_ATTRIBURES
);

export function serverSidePropsHandler({
  req,
}: {
  req: NextIronRequest;
}): GetServerSidePropsResult<CommonProps> {
  const token: SessionToken | undefined = req.session.get(TokenKey);
  const creds: OAuthCredentials | undefined = req.session.get(CredsKey);

  if (!req.session || !creds || !token) {
    return { redirect: { statusCode: 302, destination: "/login" } };
  }

  return { props: { clientId: creds.id, vertexEnv: Config.vertexEnv } };
}
