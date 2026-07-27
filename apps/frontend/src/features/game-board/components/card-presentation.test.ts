import { describe, expect, it } from "vitest";
import { getAttributeLabel } from "./card-presentation.ts";

describe("属性表示", () => {
  it("陣営ごとに防災テーマの属性名を表示する", () => {
    expect(getAttributeLabel("disaster", "attributeA")).toBe("大地");
    expect(getAttributeLabel("disaster", "attributeB")).toBe("水");
    expect(getAttributeLabel("disaster", "attributeC")).toBe("空");

    expect(getAttributeLabel("countermeasure", "attributeA")).toBe("備える力");
    expect(getAttributeLabel("countermeasure", "attributeB")).toBe("守る力");
    expect(getAttributeLabel("countermeasure", "attributeC")).toBe(
      "つながる力",
    );
  });
});
