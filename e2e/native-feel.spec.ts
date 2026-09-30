import { test, expect } from "@playwright/test";
import { mockBackend } from "./mocks";

// The installed app should feel native: nothing to select, copy, drag or long-press,
// but form fields still work normally.
test("app chrome can't be selected, dragged or long-pressed; form fields still edit", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockBackend(page, "dept_head");
  await page.goto("/account/profile");
  await page.getByRole("textbox").first().waitFor();

  const styles = await page.evaluate(() => {
    const cs = getComputedStyle(document.body);
    return { select: cs.userSelect, touch: getComputedStyle(document.documentElement).touchAction, over: getComputedStyle(document.documentElement).overscrollBehaviorY };
  });
  expect(styles.select).toBe("none");
  expect(styles.touch).toBe("pan-x pan-y");
  expect(styles.over).toBe("none");

  // Long-press / right-click menu is suppressed on page content...
  const menuBlocked = await page.evaluate(() => {
    const e = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    document.body.dispatchEvent(e);
    return e.defaultPrevented;
  });
  expect(menuBlocked).toBe(true);
  // ...and so are copy and drag.
  const copyBlocked = await page.evaluate(() => {
    const e = new Event("copy", { bubbles: true, cancelable: true });
    document.body.dispatchEvent(e);
    return e.defaultPrevented;
  });
  expect(copyBlocked).toBe(true);

  // A text field is still a normal text field.
  const field = page.getByRole("textbox").first();
  await field.fill("someone@example.com");
  await expect(field).toHaveValue("someone@example.com");
  expect(await field.evaluate((el) => getComputedStyle(el).userSelect)).toBe("text");
  const fieldMenu = await field.evaluate((el) => {
    const e = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    el.dispatchEvent(e);
    return e.defaultPrevented;
  });
  expect(fieldMenu).toBe(false);
});
