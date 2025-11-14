import React from 'react';

export const ErrorBanner: React.FC<{ message?: string }> = ({ message }) => {
  if (!message) return null;
  return (
    <div className="error-banner" role="alert">
      {message}
    </div>
  );
};
