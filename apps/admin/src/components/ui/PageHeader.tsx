import { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export default function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="mb-6 flex items-start justify-between">
      <div>
        <h1 className="text-3xl font-semibold mb-2">{title}</h1>
        {description && <p className="text-gray-600">{description}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
