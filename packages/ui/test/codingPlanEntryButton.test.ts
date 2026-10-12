// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CodingPlanEntryButton } from "@/settings/CodingPlanEntryButton.js";

// 改装版没有购买/升级弹窗，门恒为 ready：按钮只负责透传点击与禁用态。
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("passes clicks through and respects the disabled prop", () => {
  const onClick = vi.fn();
  const view = render(createElement(CodingPlanEntryButton, { onClick }, "Upgrade"));
  const button = screen.getByRole("button") as HTMLButtonElement;
  expect(button.textContent).toBe("Upgrade");
  expect(button.disabled).toBe(false);
  fireEvent.click(button);
  expect(onClick).toHaveBeenCalledTimes(1);

  view.rerender(createElement(CodingPlanEntryButton, { onClick, disabled: true }, "Upgrade"));
  expect(button.disabled).toBe(true);
  fireEvent.click(button);
  expect(onClick).toHaveBeenCalledTimes(1);
});
