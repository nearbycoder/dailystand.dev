import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group font-mono"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "border-[3px] border-ds-border-strong bg-ds-bg text-ds-fg rounded-none shadow-none",
          title: "text-[11px] font-extrabold tracking-widest uppercase",
          description: "text-xs text-ds-text-tertiary leading-relaxed",
          closeButton:
            "border-2 border-ds-muted3 bg-ds-bg text-ds-text-secondary hover:bg-ds-surface hover:text-ds-fg",
          actionButton:
            "rounded-none border-[2px] border-ds-accent bg-ds-accent px-2 py-1 text-[10px] font-extrabold tracking-widest text-ds-accent-fg hover:bg-ds-accent-hover",
          cancelButton:
            "rounded-none border-[2px] border-ds-muted3 bg-transparent px-2 py-1 text-[10px] font-extrabold tracking-widest text-ds-text-secondary hover:bg-ds-surface hover:text-ds-fg",
          success: "border-l-[6px] border-l-ds-accent",
          info: "border-l-[6px] border-l-cyan-500",
          warning: "border-l-[6px] border-l-amber-500",
          error: "border-l-[6px] border-l-red-500",
          loading: "border-l-[6px] border-l-ds-muted",
        },
      }}
      style={
        {
          "--normal-bg": "var(--ds-bg)",
          "--normal-text": "var(--ds-fg)",
          "--normal-border": "var(--ds-border-strong)",
          "--border-radius": "0px",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
