import { forwardRef } from "react";
import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes } from "react";

export function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60",
        variant === "primary" && "bg-[var(--accent)] text-white shadow-[0_10px_30px_rgba(45,104,255,0.22)]",
        variant === "secondary" && "border border-[var(--line)] bg-white text-[var(--foreground)]",
        variant === "ghost" && "text-[var(--muted)]",
        className
      )}
      {...props}
    />
  );
}

export function Surface({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx(
        "rounded-[28px] border border-[var(--line)] bg-white shadow-[0_18px_60px_rgba(18,35,71,0.08)]",
        className
      )}
      {...props}
    />
  );
}

export const FieldInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function FieldInput(
  { className, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      className={cx(
        "w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[#9aa3b2] focus:border-[var(--accent)]",
        className
      )}
      {...props}
    />
  );
});

export const FieldTextarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function FieldTextarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cx(
          "w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[#9aa3b2] focus:border-[var(--accent)]",
          className
        )}
        {...props}
      />
    );
  }
);

export function SectionTitle({
  eyebrow,
  title,
  description
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="grid gap-1">
      {eyebrow ? <p className="text-xs font-medium text-[var(--accent)]">{eyebrow}</p> : null}
      <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">{title}</h1>
      {description ? <p className="max-w-2xl text-sm leading-6 text-[var(--muted)]">{description}</p> : null}
    </div>
  );
}
