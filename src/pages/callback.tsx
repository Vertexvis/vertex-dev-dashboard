import { GetServerSidePropsContext, GetServerSidePropsResult } from "next";


export interface Props {
  readonly token: string;
}

export default function Callback({ token }: Props): JSX.Element {
  return <>{token}</>;
}

export async function getServerSideProps(
  context: GetServerSidePropsContext
): Promise<GetServerSidePropsResult<Props>> {
  console.log(context.query);

  return {
    props: {
      token: 'token'
    },
  };
}