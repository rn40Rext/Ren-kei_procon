import test from "node:test";
import assert from "node:assert/strict";
import { instructorLabel } from "./renLabel";

test("連の名前があれば「○○連の連長」の形にする", () => {
  assert.equal(instructorLabel("阿波徳島連"), "阿波徳島連の連長");
});

test("連の名前の前後の空白は取り除く", () => {
  assert.equal(instructorLabel("  新進連 "), "新進連の連長");
});

test("連の名前が分からないときは「師匠の教え」にする", () => {
  assert.equal(instructorLabel(undefined), "師匠の教え");
  assert.equal(instructorLabel(null), "師匠の教え");
  assert.equal(instructorLabel(""), "師匠の教え");
  assert.equal(instructorLabel("   "), "師匠の教え");
});
