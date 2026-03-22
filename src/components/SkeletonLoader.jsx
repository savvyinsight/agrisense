import React from 'react';
import { Skeleton, Card, CardContent, Box, Grid } from '@mui/material';

const DeviceCardSkeleton = () => (
  <Card sx={{ height: '100%' }}>
    <CardContent>
      <Skeleton variant="text" width="70%" height={32} />
      <Skeleton variant="text" width="40%" />
      <Skeleton variant="text" width="60%" sx={{ mt: 1 }} />
      <Skeleton variant="rectangular" height={40} sx={{ mt: 2 }} />
    </CardContent>
  </Card>
);

const ChartSkeleton = () => (
  <Card sx={{ mt: 4 }}>
    <CardContent>
      <Skeleton variant="text" width="50%" height={32} />
      <Skeleton variant="rectangular" height={300} sx={{ mt: 2 }} />
    </CardContent>
  </Card>
);

const AlertSkeleton = () => (
  <Card sx={{ mb: 3 }}>
    <CardContent>
      <Skeleton variant="text" width="30%" height={32} />
      <Skeleton variant="text" width="90%" />
      <Skeleton variant="text" width="80%" />
    </CardContent>
  </Card>
);

export { DeviceCardSkeleton, ChartSkeleton, AlertSkeleton };