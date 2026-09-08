import "@udibo/juniper/utils/global-jsdom";

import { assert, assertEquals, assertThrows } from "@std/assert";
import { afterEach, describe, it } from "@std/testing/bdd";
import { userEvent } from "@testing-library/user-event";

function formFrom(html: string): HTMLFormElement {
  document.body.innerHTML = html;
  return document.querySelector("form")!;
}

afterEach(() => document.body.replaceChildren());

describe("FormData from a JSDOM form", () => {
  it("submits checked controls and preserves repeated names in document order", () => {
    const form = formFrom(`<form>
      <input name="choice" type="checkbox" value="unchecked">
      <input name="choice" type="checkbox" value="first" checked>
      <input name="choice" type="checkbox" checked>
      <input name="radio" type="radio" value="no">
      <input name="radio" type="radio" value="yes" checked>
      <textarea name="choice">last</textarea>
    </form>`);
    assertEquals([...new FormData(form)], [
      ["choice", "first"],
      ["choice", "on"],
      ["radio", "yes"],
      ["choice", "last"],
    ]);
  });

  it("omits disabled and datalist controls but keeps the first legend and readonly values", () => {
    const form = formFrom(`<form>
      <input name="disabled" disabled value="no">
      <fieldset disabled>
        <legend><input name="legend" value="yes"></legend>
        <input name="fieldset" value="no">
        <legend><input name="secondLegend" value="no"></legend>
      </fieldset>
      <datalist><input name="suggestion" value="no"></datalist>
      <input name="readonly" readonly value="yes">
      <input value="unnamed">
    </form>`);
    assertEquals([...new FormData(form)], [["legend", "yes"], [
      "readonly",
      "yes",
    ]]);
  });

  it("submits every selected enabled option and no unselected options", () => {
    const form = formFrom(`<form><select name="scope" multiple>
      <option value="read" selected>Read</option>
      <option value="write" selected>Write</option>
      <option value="unselected">Unselected</option>
      <option value="disabled" selected disabled>Disabled</option>
      <optgroup disabled><option value="group" selected>Group</option></optgroup>
    </select></form>`);
    assertEquals(new FormData(form).getAll("scope"), ["read", "write"]);
  });

  it("includes only the chosen submitter, including an associated external button", () => {
    const form = formFrom(`<input form="entry" name="outside" value="before">
      <form id="entry">
        <input name="title" value="draft">
        <button name="intent" value="save">Save</button>
        <input name="reset" type="reset" value="Reset">
        <input name="button" type="button" value="Button">
        <input name="elsewhere" form="other" value="no">
      </form>
      <button id="publish" form="entry" name="intent" value="publish">Publish</button>
      <form id="other"></form>`);
    const submitter = document.getElementById("publish")!;
    assertEquals([...new FormData(form)], [["outside", "before"], [
      "title",
      "draft",
    ]]);
    assertEquals([...new FormData(form, submitter)], [
      ["outside", "before"],
      ["title", "draft"],
      ["intent", "publish"],
    ]);
  });

  it("rejects a non-submit control or a submitter owned by another form", () => {
    const form = formFrom(`<form><input id="text"></form>
      <form><button id="foreign">Other</button></form>`);
    assertThrows(
      () => new FormData(form, document.getElementById("text")!),
      TypeError,
    );
    const error = assertThrows(
      () => new FormData(form, document.getElementById("foreign")!),
      DOMException,
    );
    assertEquals(error.name, "NotFoundError");
  });

  it("includes image coordinates only for the selected image submitter", () => {
    const form = formFrom(
      `<form><input type="image" name="position" id="image"></form>`,
    );
    assertEquals([...new FormData(form)], []);
    assertEquals([...new FormData(form, document.getElementById("image")!)], [
      ["position.x", "0"],
      ["position.y", "0"],
    ]);
  });

  it("represents an empty file input with an empty file rather than text", async () => {
    const form = formFrom(`<form><input type="file" name="attachment"></form>`);
    const file = new FormData(form).get("attachment");
    assert(file instanceof File);
    assertEquals([file.name, file.type, file.size], [
      "",
      "application/octet-stream",
      0,
    ]);
    assertEquals(await file.text(), "");
  });

  it("rejects JSDOM file objects instead of silently corrupting their bytes", async () => {
    const form = formFrom(`<form><input type="file" name="attachment"></form>`);
    await userEvent.setup().upload(
      form.querySelector("input")!,
      new document.defaultView!.File(["bytes"], "jsdom.txt"),
    );
    assertThrows(
      () => new FormData(form),
      TypeError,
      "global File constructor",
    );
  });

  it("preserves uploaded bytes and filenames through a Deno multipart request", async () => {
    const form = formFrom(
      `<form><input type="file" name="attachment" multiple></form>`,
    );
    const first = new File([new Uint8Array([0, 255, 10, 13])], "first.bin", {
      type: "application/octet-stream",
    });
    const second = new File(["hello"], "second.txt", { type: "text/plain" });
    await userEvent.setup().upload(form.querySelector("input")!, [
      first,
      second,
    ]);
    const request = new Request("http://localhost/upload", {
      method: "POST",
      body: new FormData(form),
    });
    const files = (await request.formData()).getAll("attachment");
    assertEquals(files.length, 2);
    assert(files[0] instanceof File && files[1] instanceof File);
    assertEquals([files[0], files[1]].map((file) => [file.name, file.type]), [[
      "first.bin",
      "application/octet-stream",
    ], ["second.txt", "text/plain"]]);
    assertEquals(
      new Uint8Array(await files[0].arrayBuffer()),
      new Uint8Array([0, 255, 10, 13]),
    );
    assertEquals(await files[1].text(), "hello");
  });
});
