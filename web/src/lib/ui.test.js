import { describe, expect, it } from "vitest";
import { frSpace, applyFrenchSpacing, rich } from "./ui.js";

const N = " ";

describe("French spacing", () => {
  it("binds high punctuation to the word before it", () => {
    expect(frSpace("Source : DGAC")).toBe(`Source${N}: DGAC`);
    expect(frSpace("Et votre aéroport ?")).toBe(`Et votre aéroport${N}?`);
    expect(frSpace("chaque pays ; à droite !")).toBe(`chaque pays${N}; à droite${N}!`);
    expect(frSpace("« vols »")).toBe(`«${N}vols${N}»`);
  });

  it("handles a text node that starts right after an inline element", () => {
    expect(frSpace(" : la suite")).toBe(`${N}: la suite`);
    expect(frSpace("(kt\n      : milliers")).toBe(`(kt${N}: milliers`);
  });

  it("glues a unit to its number with the same narrow space as the formatters", () => {
    expect(frSpace("41 % en 2025, 713 kt, 1\u00a0500 km")).toBe(
      `41${N}% en 2025, 713${N}kt, 1\u00a0500${N}km`,
    );
    expect(frSpace("2 Mars, 3 grands, 12 km/h")).toBe(`2 Mars, 3 grands, 12${N}km/h`);
  });

  it("leaves code-like and already spaced text alone", () => {
    expect(frSpace("https://aviationdata.vercel.app/")).toBe("https://aviationdata.vercel.app/");
    expect(frSpace(`déjà${N}: bon`)).toBe(`déjà${N}: bon`);
    expect(frSpace("08:30")).toBe("08:30");
  });

  it("walks every text node of a tree, SVG included", () => {
    document.body.innerHTML = `<p>Covid : <b>−99 %</b> ?</p><svg><text>Lyon : 9 M</text></svg>`;
    applyFrenchSpacing(document.body);
    expect(document.querySelector("p").textContent).toBe(`Covid${N}: −99${N}%${N}?`);
    expect(document.querySelector("text").textContent).toBe(`Lyon${N}: 9${N}M`);
  });
});

describe("rich", () => {
  it("keeps a number with the word after it", () => {
    const p = document.createElement("p");
    p.append(rich(["a émis ", { b: "22,2 millions de tonnes" }, "."]));
    expect(p.querySelector("strong").textContent).toBe("22,2 millions de tonnes");
  });
});
