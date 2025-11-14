import React from 'react';

export type ErrorBannerProps = {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export const ErrorBanner: React.FC<ErrorBannerProps> = ({ message, actionLabel, onAction }) => (
  <div className="error-banner" role="alert">
    <span>{message}</span>
    {actionLabel && onAction && (
      <button type="button" onClick={onAction}>
        {actionLabel}
      </button>
    )}
  </div>
);
