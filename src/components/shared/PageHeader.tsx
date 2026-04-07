import React from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}

const PageHeader: React.FC<PageHeaderProps> = ({ title, description, actions, children }) => {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
      <div>
        <h1 className="text-3xl font-black tracking-tight">{title}</h1>
        {description && (
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            {description}
          </p>
        )}
      </div>
      <div className="flex items-center gap-3">
        {actions}
        {children}
      </div>
    </div>
  );
};

export default PageHeader;
