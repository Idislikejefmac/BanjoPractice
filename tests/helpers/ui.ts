// Small helpers for the controls that live behind other controls.
import type { Page } from "@playwright/test";

/**
 * Tab only, Rolls, Loop and "More playback settings" are in the ⚙ page (not the toolbar): open
 * it and touch the one wanted. It takes him back to the song with that panel open.
 */
export async function viaSettings(
  page: Page,
  action: "toggle-view" | "rolls" | "loop" | "mixer",
): Promise<void> {
  await page.click('[data-action="settings"]');
  await page.click(`.settings-page [data-action="${action}"]`);
}

/** Hides the song list if it's showing, shows it if it's hidden (the ‹ and › tabs). */
export async function toggleSongs(page: Page): Promise<void> {
  await page
    .locator('[data-action="hide-songs"]:visible, [data-action="show-songs"]:visible')
    .click();
}
