import { LucideIcon, PackageOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
}

export const EmptyState = ({
  icon: Icon = PackageOpen,
  title,
  description,
  action
}: EmptyStateProps) => {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-16 px-4">
      <Icon className="w-16 h-16 text-muted-foreground/50 mb-4" />
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground text-center max-w-md mb-6">
        {description}
      </p>
      {action && (
        action.href ? (
          <Button asChild>
            <Link to={action.href}>{action.label}</Link>
          </Button>
        ) : (
          <Button onClick={action.onClick}>{action.label}</Button>
        )
      )}
    </div>
  );
};
