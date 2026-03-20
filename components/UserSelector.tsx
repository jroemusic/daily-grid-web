'use client';

import { useState, useEffect } from 'react';

const USERS = [
  { id: 'jason', name: 'Jason', color: '#1976d2' },
  { id: 'kay', name: 'Kay', color: '#e91e63' },
  { id: 'emma', name: 'Emma', color: '#4caf50' },
  { id: 'toby', name: 'Toby', color: '#ff9800' }
];

interface UserSelectorProps {
  onUserChange?: (userId: string | null) => void;
}

export default function UserSelector({ onUserChange }: UserSelectorProps) {
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  useEffect(() => {
    // Load saved user from localStorage
    const saved = localStorage.getItem('grid-user');
    if (saved) {
      setSelectedUser(saved);
      onUserChange?.(saved);
    }
  }, []);

  const handleSelect = (userId: string | null) => {
    setSelectedUser(userId);
    if (userId) {
      localStorage.setItem('grid-user', userId);
    } else {
      localStorage.removeItem('grid-user');
    }
    onUserChange?.(userId);
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-600">Logged in as:</span>
      <div className="flex gap-1">
        {USERS.map(user => (
          <button
            key={user.id}
            onClick={() => handleSelect(selectedUser === user.id ? null : user.id)}
            className={`
              px-3 py-1 rounded-full text-sm font-medium transition-all
              ${selectedUser === user.id
                ? 'ring-2 ring-offset-2'
                : 'opacity-60 hover:opacity-100'}
            `}
            style={{
              backgroundColor: user.color,
              color: 'white'
            }}
          >
            {user.name}
          </button>
        ))}
      </div>
    </div>
  );
}

export { USERS };
