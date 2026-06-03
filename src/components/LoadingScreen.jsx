import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { Event } from '@mui/icons-material';

export default function LoadingScreen() {
  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      minHeight: '100vh', 
      gap: 2, 
      background: 'linear-gradient(135deg, #1a1f5e 0%, #3d44a0 100%)' 
    }}>
      <Event sx={{ fontSize: 48, color: 'white', animation: 'pulse 2s infinite' }} />
      <Typography variant="h5" color="white" fontWeight={800}>EventSphere</Typography>
      <CircularProgress sx={{ color: '#ff6b35' }} />
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
    </Box>
  );
}