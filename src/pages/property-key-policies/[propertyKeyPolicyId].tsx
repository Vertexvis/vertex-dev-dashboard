import { Box, Breadcrumbs, Paper, Typography } from "@mui/material";
import { head } from "@vertexvis/api-client-node";
import { GetServerSidePropsResult } from "next";
import { withIronSession } from "next-iron-session";
import React from "react";
import useSWR from "swr";

import { PropertyKeyPolicyKeysList } from "../../components/property-key-policy/PropertyKeyPolicyKeysList";
import { PropertyKeyPolicyMetadataTable } from "../../components/property-key-policy/PropertyKeyPolicyMetadataTable";
import { AppLink } from "../../components/shared/AppLink";
import { Layout } from "../../components/shared/Layout";
import { isErrorFailure, isErrorRes, toErrorRes } from "../../lib/api";
import {
  getPropertyKeyPoliciesApi,
  GetPropertyKeyPolicyKeysRes,
  PropertyKeyPolicy,
  toPropertyKeyPolicy,
  toPropertyKeyPolicyKey,
} from "../../lib/property-key-policies";
import { getClientFromSession, makeCall } from "../../lib/vertex-api";
import {
  CommonProps,
  CookieAttributes,
  NextIronRequest,
  serverSidePropsHandler as commonServerSidePropsHandler,
} from "../../lib/with-session";

interface Props {
  readonly propertyKeyPolicy: PropertyKeyPolicy;
}

type ServerSideProps = CommonProps & Props;

interface ServerSideContext {
  readonly query: {
    readonly propertyKeyPolicyId?: string | string[];
  };
  readonly req: NextIronRequest;
}

export default function PropertyKeyPolicyDetails({
  propertyKeyPolicy,
}: Props): JSX.Element {
  const { data, error } = useSWR<GetPropertyKeyPolicyKeysRes | undefined>(
    `/api/property-key-policies/${encodeURIComponent(
      propertyKeyPolicy.id,
    )}/keys`,
  );

  const keysFailed = error != null || isErrorRes(data);
  const keys =
    data != null && !isErrorRes(data)
      ? data.data.map(toPropertyKeyPolicyKey)
      : undefined;
  const keysLoading = keys == null && !keysFailed;

  return (
    <Layout
      main={
        <Box sx={{ p: 2 }}>
          <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 2 }}>
            <AppLink href="/property-key-policies" underline="hover">
              Property Key Policies
            </AppLink>
            <Typography color="text.primary">
              {propertyKeyPolicy.name ?? propertyKeyPolicy.id}
            </Typography>
          </Breadcrumbs>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h5">Property Key Policy</Typography>
            <Typography
              color="text.secondary"
              sx={{ overflowWrap: "anywhere", whiteSpace: "normal" }}
              variant="body2"
            >
              {propertyKeyPolicy.id}
            </Typography>
            <Box sx={{ mt: 2 }}>
              <PropertyKeyPolicyMetadataTable
                propertyKeyPolicy={propertyKeyPolicy}
              />
            </Box>
            <Box sx={{ mt: 1 }}>
              <PropertyKeyPolicyKeysList
                keys={keys}
                error={keysFailed}
                loading={keysLoading}
              />
            </Box>
          </Paper>
        </Box>
      }
    />
  );
}

export const getServerSideProps = withIronSession(
  serverSidePropsHandler,
  CookieAttributes,
);

export async function serverSidePropsHandler({
  query,
  req,
}: ServerSideContext): Promise<GetServerSidePropsResult<ServerSideProps>> {
  const authResult = commonServerSidePropsHandler({ req });
  if (!("props" in authResult)) return authResult;

  const propertyKeyPolicyId = head(query.propertyKeyPolicyId);
  if (propertyKeyPolicyId == null) return { notFound: true };

  const api = getPropertyKeyPoliciesApi(
    await getClientFromSession(req.session),
  );
  const res = await makeCall(() =>
    api.getPropertyKeyPolicy({ id: propertyKeyPolicyId }),
  );

  if (isErrorFailure(res)) {
    const error = toErrorRes({ failure: res });
    if (error.status === 400 || error.status === 404) return { notFound: true };

    throw new Error(error.message);
  }

  return {
    props: {
      ...(authResult.props as CommonProps),
      propertyKeyPolicy: toPropertyKeyPolicy(res.data),
    },
  };
}
