import { cn } from "../helpers/utils";

export function SettingsRow({
  label,
  description,
  action,
  children,
  last,
}: {
  label: string;
  description: string;
  action: JSX.Element;
  children?: JSX.Element | JSX.Element[];
  last?: boolean;
}): JSX.Element {
  return (
    <div>
      <div
        className={cn(
          "flex min-h-16 items-center justify-start gap-4 rounded bg-gray-50 p-2 pl-3 dark:bg-gray-700/65",
          { "rounded-b-none": last },
        )}
      >
        <div>
          <label htmlFor="">{label}</label>
          <div className="text-xs text-gray-400">{description}</div>
        </div>
        <div className="ml-auto">{action}</div>
      </div>
      {children}
    </div>
  );
}

export function SubSettingsRow({
  label,
  description,
  action,
  last,
  collapseElement,
}: {
  label: string;
  description?: string;
  action: JSX.Element;
  last?: boolean;
  collapseElement: boolean;
}): JSX.Element {
  return (
    <div
      {...{ inert: collapseElement ? "" : undefined }} // type script react does not recognize inert
      className={cn("transition-max-height overflow-clip duration-300", {
        "max-h-60 ease-in": !collapseElement,
        "max-h-0 ease-out": collapseElement,
      })}
    >
      <div className="pt-0.5">
        <div
          className={cn(
            "flex items-center justify-start gap-4 rounded-none bg-gray-50 p-2 pl-6 dark:bg-gray-700/70",
            { "rounded-b": last },
          )}
        >
          <div>
            <label htmlFor="">{label}</label>
            <div className="text-xs text-gray-400">{description}</div>
          </div>
          <div className="ml-auto">{action}</div>
        </div>
      </div>
    </div>
  );
}
