import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/** Shared Streamly notification styling across all success, error and info messages. */
const Toaster = ({ ...props }: ToasterProps) => (
  <Sonner
    position="top-right"
    richColors={false}
    closeButton
    visibleToasts={4}
    duration={4000}
    gap={10}
    className="streamly-toaster"
    toastOptions={{
      classNames: {
        toast: "streamly-toast",
        title: "streamly-toast-title",
        description: "streamly-toast-description",
        success: "streamly-toast-success",
        error: "streamly-toast-error",
        warning: "streamly-toast-warning",
        info: "streamly-toast-info",
        closeButton: "streamly-toast-close",
        actionButton: "streamly-toast-action",
        cancelButton: "streamly-toast-cancel",
      },
    }}
    {...props}
  />
);

export { Toaster };
