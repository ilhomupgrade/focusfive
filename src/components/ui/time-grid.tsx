import * as React from "react";
import { cn } from "@/lib/utils";

interface TimeGridProps extends React.HTMLAttributes<HTMLDivElement> {
  times: string[];
  className?: string;
}

const TimeGrid = React.forwardRef<HTMLDivElement, TimeGridProps>(
  ({ times, className, ...props }, ref) => {
    return (
      <div 
        ref={ref} 
        className={cn("flex flex-col", className)} 
        {...props}
      >
        {times.map((time) => (
          <div 
            key={time} 
            className="h-16 flex items-center justify-end pr-4 text-xs text-neutral-400 border-b border-neutral-800"
          >
            {time}
          </div>
        ))}
      </div>
    );
  }
);

TimeGrid.displayName = "TimeGrid";

export { TimeGrid };