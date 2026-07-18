import { describe, expect, it } from "vitest";

import { getDictionary } from "../../lib/i18n/dictionaries";

describe("English and French dictionaries", () => {
  it("have identical non-empty key sets", () => {
    const en = getDictionary("en");
    const fr = getDictionary("fr");
    expect(Object.keys(fr).sort()).toEqual(Object.keys(en).sort());
    for (const value of [...Object.values(en), ...Object.values(fr)]) expect(value.trim()).not.toBe("");
  });

  it("never renders dictionary key names as values", () => {
    for (const locale of ["en", "fr"] as const) {
      for (const [key, value] of Object.entries(getDictionary(locale))) expect(value).not.toBe(key);
    }
  });
});
