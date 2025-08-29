import React from 'react';
import { motion } from 'framer-motion';
import {
  Wifi as WifiIcon, 
  WifiOff as WifiOffIcon, 
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon 
} from '@mui/icons-material';
import { theme } from '../styles/theme';

const ConnectionStatus = ({ isConnected, isConnecting, onRetry }) => {
  const getStatusConfig = () => {
    if (isConnected) {
      return {
        icon: CheckCircleIcon,
        text: 'Connected',
        color: theme.colors.success,
        bgColor: `${theme.colors.success}20`,
      };
    }
    if (isConnecting) {
      return {
        icon: WifiIcon,
        text: 'Connecting...',
        color: theme.colors.warning,
        bgColor: `${theme.colors.warning}20`,
      };
    }
    return {
      icon: WifiOffIcon,
      text: 'Disconnected',
      color: theme.colors.error,
      bgColor: `${theme.colors.error}20`,
    };
  };

  const { icon: StatusIcon, text, color, bgColor } = getStatusConfig();

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing.sm,
        padding: `${theme.spacing.sm} ${theme.spacing.md}`,
        backgroundColor: bgColor,
        borderRadius: theme.borderRadius.md,
        border: `1px solid ${color}40`,
        fontSize: '0.875rem',
        fontWeight: '500',
        height: '40px',
        minWidth: 'fit-content',
      }}
    >
      <motion.div
        animate={isConnecting ? { rotate: 360 } : {}}
        transition={{ duration: 1, repeat: isConnecting ? Infinity : 0 }}
      >
        <StatusIcon sx={{ fontSize: 16, color }} />
      </motion.div>
      
      <span style={{ color }}>{text}</span>
      
      {!isConnected && !isConnecting && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onRetry}
          style={{
            background: 'none',
            border: 'none',
            color,
            cursor: 'pointer',
            padding: theme.spacing.xs,
            borderRadius: theme.borderRadius.sm,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <RefreshIcon sx={{ fontSize: 16 }} />
        </motion.button>
      )}
    </motion.div>
  );
};

export default ConnectionStatus;