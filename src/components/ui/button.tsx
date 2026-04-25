import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const variants = {
  primary: "bg-black text-white hover:bg-gray-800",
  secondary: "border border-gray-200 bg-white text-black hover:bg-gray-50",
  ghost: "bg-transparent text-black hover:underline",
} as const;

const sizes = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
} as const;

const baseButtonClasses =
  "inline-flex items-center justify-center rounded-lg font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black disabled:pointer-events-none disabled:opacity-50 cursor-pointer";

/**
 * Returns the same class string the <Button> component would render.
 * Use this when you need to style a <Link> or <a> as a button — never
 * wrap a <Button> inside an <a>/<Link>, because nesting an interactive
 * <button> inside an anchor is invalid HTML and breaks tap-to-navigate
 * on iOS Safari (the inner button swallows the touch and the anchor
 * never fires). This was the root cause of the broken mobile "Sign In"
 * header link. Always do:
 *   <Link className={buttonClasses({ variant: "ghost", size: "sm" })}>...
 */
export function buttonClasses(opts: {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  className?: string;
} = {}) {
  const { variant = "primary", size = "md", className } = opts;
  return cn(baseButtonClasses, variants[variant], sizes[size], className);
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={buttonClasses({ variant, size, className })}
      {...props}
    />
  )
);
Button.displayName = "Button";
