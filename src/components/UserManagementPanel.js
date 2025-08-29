import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    PersonAdd as PersonAddIcon,
    PersonRemove as PersonRemoveIcon,
    Close as CloseIcon,
    Search as SearchIcon,
} from '@mui/icons-material';
import { theme } from '../styles/theme';

const UserManagementPanel = ({
    isOpen,
    onClose,
    onAddUser,
    onRemoveUser,
    currentChannel,
    onlineUsers,
    channelUsers = []
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedUser, setSelectedUser] = useState('');

    const filteredUsers = onlineUsers.filter(user =>
        user.toLowerCase().includes(searchTerm.toLowerCase()) &&
        user !== localStorage.getItem('username')
    );

    const availableUsers = filteredUsers.filter(user =>
        !channelUsers.includes(user)
    );

    const handleAddUser = () => {
        if (selectedUser && onAddUser) {
            onAddUser(selectedUser);
            setSelectedUser('');
            setSearchTerm('');
        }
    };

    const handleRemoveUser = (username) => {
        if (onRemoveUser) {
            onRemoveUser(username);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                }}
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        backgroundColor: theme.colors.surface,
                        borderRadius: theme.borderRadius.lg,
                        padding: theme.spacing.xl,
                        width: '90%',
                        maxWidth: '500px',
                        maxHeight: '80vh',
                        overflow: 'auto',
                        border: `1px solid ${theme.colors.border}`,
                    }}
                >
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: theme.spacing.lg,
                    }}>
                        <h2 style={{
                            color: theme.colors.text,
                            margin: 0,
                            fontSize: '1.5rem',
                        }}>
                            Manage #{currentChannel}
                        </h2>
                        <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={onClose}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: theme.colors.textSecondary,
                                cursor: 'pointer',
                                padding: theme.spacing.sm,
                                borderRadius: theme.borderRadius.full,
                            }}
                        >
                            <CloseIcon />
                        </motion.button>
                    </div>

                    {/* Add User Section */}
                    <div style={{ marginBottom: theme.spacing.xl }}>
                        <h3 style={{
                            color: theme.colors.text,
                            marginBottom: theme.spacing.md,
                            fontSize: '1.1rem',
                        }}>
                            Add User
                        </h3>

                        <div style={{
                            display: 'flex',
                            gap: theme.spacing.sm,
                            marginBottom: theme.spacing.md,
                        }}>
                            <div style={{ position: 'relative', flex: 1 }}>
                                <SearchIcon style={{
                                    position: 'absolute',
                                    left: theme.spacing.sm,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    color: theme.colors.textMuted,
                                    fontSize: '1.2rem',
                                }} />
                                <input
                                    type="text"
                                    placeholder="Search users..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: `${theme.spacing.sm} ${theme.spacing.sm} ${theme.spacing.sm} 2.5rem`,
                                        backgroundColor: theme.colors.background,
                                        border: `1px solid ${theme.colors.border}`,
                                        borderRadius: theme.borderRadius.md,
                                        color: theme.colors.text,
                                        fontSize: '1rem',
                                    }}
                                />
                            </div>
                        </div>

                        <div style={{
                            maxHeight: '150px',
                            overflowY: 'auto',
                            border: `1px solid ${theme.colors.border}`,
                            borderRadius: theme.borderRadius.md,
                            backgroundColor: theme.colors.background,
                        }}>
                            {availableUsers.map(user => (
                                <motion.div
                                    key={user}
                                    whileHover={{ backgroundColor: theme.colors.surfaceHover }}
                                    onClick={() => setSelectedUser(user)}
                                    style={{
                                        padding: theme.spacing.md,
                                        cursor: 'pointer',
                                        borderBottom: `1px solid ${theme.colors.border}`,
                                        backgroundColor: selectedUser === user ? theme.colors.primary + '20' : 'transparent',
                                        color: theme.colors.text,
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                    }}
                                >
                                    <span>{user}</span>
                                    {selectedUser === user && (
                                        <motion.button
                                            whileHover={{ scale: 1.1 }}
                                            whileTap={{ scale: 0.9 }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleAddUser();
                                            }}
                                            style={{
                                                backgroundColor: theme.colors.primary,
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: theme.borderRadius.sm,
                                                padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: theme.spacing.xs,
                                            }}
                                        >
                                            <PersonAddIcon sx={{ fontSize: 16 }} />
                                            Add
                                        </motion.button>
                                    )}
                                </motion.div>
                            ))}
                            {availableUsers.length === 0 && (
                                <div style={{
                                    padding: theme.spacing.lg,
                                    textAlign: 'center',
                                    color: theme.colors.textMuted,
                                }}>
                                    No available users to add
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Current Users Section */}
                    <div>
                        <h3 style={{
                            color: theme.colors.text,
                            marginBottom: theme.spacing.md,
                            fontSize: '1.1rem',
                        }}>
                            Current Users ({channelUsers.length})
                        </h3>

                        <div style={{
                            maxHeight: '200px',
                            overflowY: 'auto',
                            border: `1px solid ${theme.colors.border}`,
                            borderRadius: theme.borderRadius.md,
                            backgroundColor: theme.colors.background,
                        }}>
                            {channelUsers.map(user => (
                                <motion.div
                                    key={user}
                                    whileHover={{ backgroundColor: theme.colors.surfaceHover }}
                                    style={{
                                        padding: theme.spacing.md,
                                        borderBottom: `1px solid ${theme.colors.border}`,
                                        color: theme.colors.text,
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                    }}
                                >
                                    <span>{user}</span>
                                    {user !== localStorage.getItem('username') && (
                                        <motion.button
                                            whileHover={{ scale: 1.1 }}
                                            whileTap={{ scale: 0.9 }}
                                            onClick={() => handleRemoveUser(user)}
                                            style={{
                                                backgroundColor: theme.colors.error,
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: theme.borderRadius.sm,
                                                padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: theme.spacing.xs,
                                            }}
                                        >
                                            <PersonRemoveIcon sx={{ fontSize: 16 }} />
                                            Remove
                                        </motion.button>
                                    )}
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default UserManagementPanel;