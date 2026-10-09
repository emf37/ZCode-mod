import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button.js";

/**
 * 各入口的查询门。改装版没有购买/升级弹窗，也就不再预查套餐商品列表：
 * 门恒为 ready，按钮行为完全由调用方决定。
 */
export function useCodingPlanEntryGate(): {
  status: "loading" | "error" | "ready";
  label: string | undefined;
  retry: (() => void) | undefined;
} {
  return { status: "ready", label: undefined, retry: undefined };
}

/** 各入口共享同一查询状态；失败时按钮只重试，不继续执行购买动作。 */
export function CodingPlanEntryButton({
  children,
  disabled,
  onClick,
  bypassGate = false,
  ...props
}: ComponentProps<typeof Button> & { bypassGate?: boolean }) {
  const gate = useCodingPlanEntryGate();
  const status = bypassGate ? "ready" : gate.status;
  return (
    <Button
      {...props}
      disabled={disabled || status === "loading"}
      aria-label={status === "ready" ? props["aria-label"] : gate.label}
      aria-busy={status === "loading"}
      title={status === "ready" ? props.title : gate.label}
      onClick={(event) => {
        if (status === "error") {
          event.preventDefault();
          event.stopPropagation();
          gate.retry?.();
          return;
        }
        if (status === "ready") onClick?.(event);
      }}
    >
      {status === "ready" ? children : gate.label}
    </Button>
  );
}
