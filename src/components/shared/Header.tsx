/* @jsx jsx */ /** @jsxRuntime classic */ import { jsx } from '@emotion/react';
import { Box, Button } from '@mui/material';
import Image from 'next/image';
import { useRouter } from 'next/router';

import { reportError } from '../../lib/report-error';
import { AppLink } from './AppLink';

export function Header(): JSX.Element {
  const router = useRouter();

  async function handleSignOut(): Promise<void> {
    await fetch('/api/logout');
    await router.push('/login');
  }

  return (
    <Box
      sx={{
        alignItems: 'center',
        display: 'flex',
        justifyContent: 'space-between',
        width: '100%',
        height: '56px',
      }}
    >
      <Box sx={{ alignItems: 'center', display: 'flex' }}>
        <AppLink href="/" paddingRight={'16px'}>
          <Image src="/vertex-logo.svg" alt="Vertex" width="29" height="28" />
        </AppLink>
        <p>Vertex Developer Dashboard</p>
      </Box>
      <Box sx={{ ml: 'auto' }}>
        <Button
          onClick={() => {
            handleSignOut().catch(reportError('Failed to sign out'));
          }}
        >
          Sign Out
        </Button>
      </Box>
    </Box>
  );
}
