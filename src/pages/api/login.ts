import { logError, OAuth2Token } from "@vertexvis/api-client-node";
import { NextApiResponse } from "next";

import { ErrorRes, MethodNotAllowed, Res } from "../../lib/api";
import { getToken } from "../../lib/vertex-api";
import withSession, {
  EnvironmentWithCustom,
  NetworkConfig,
  NextIronRequest,
  OAuthCredentials,
  SessionToken,
  setCreds,
  setEnv,
  setToken,
} from "../../lib/with-session";

// debugging
import { networkInterfaces } from "os";
import { request } from "https";

export interface LoginReq {
  readonly id: string;
  readonly secret: string;
  readonly env: EnvironmentWithCustom;
  readonly networkConfig?: NetworkConfig;
}

export default withSession(async function (
  req: NextIronRequest,
  res: NextApiResponse<Res | ErrorRes>
) {
  if (req.method === "POST") {
    const b: LoginReq = JSON.parse(req.body);

    let token: OAuth2Token | undefined;
    try {
      token = await getToken(b.id, b.secret, b.env, b.networkConfig);
    } catch (e) {
      // debugging
      logError(e);
      console.log(b.networkConfig);
      console.log(networkInterfaces());
      console.log("attempting to open connection with apiHost");

      try {
        const options = { hostname: b.networkConfig?.apiHost.replace("https://", "").replace("/", ""), port: 443, path: '/', method: 'GET' };
        const req = request(options, (res) => {
          res.on('error', (e) => {
            logError(e);
          })
        });

        req.on('error', (e) => {
          logError(e);
        });

        req.end();
      } catch (e) {
        logError(e);
      }

      return res.status(401).json({ status: 401, message: "Unauthorized" });
    }

    const creds: OAuthCredentials = { id: b.id, secret: b.secret };
    const sessionToken: SessionToken = {
      token,
      expiration: Date.now() + token.expires_in * 1000,
    };
    setCreds(req.session, creds);
    setEnv(req.session, b.env, b.networkConfig);
    setToken(req.session, sessionToken);

    await req.session.save();

    const r = { status: 200 };
    return res.status(r.status).json(r);
  }

  return res.status(MethodNotAllowed.status).json(MethodNotAllowed);
});
