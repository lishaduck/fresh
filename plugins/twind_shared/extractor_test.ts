import { assertEquals } from "$std/assert/mod.ts";
import {
  extractAndExpandClassNames,
  ExtractClassNamesOptions,
  ExtractResult,
} from "./extractor.ts";

function testExtract(
  input: string,
  expected: ExtractResult,
  options: ExtractClassNamesOptions = {},
) {
  const res = extractAndExpandClassNames(input, options);
  assertEquals(res, expected);
}

Deno.test("extract - css classes", () => {
  testExtract(`<div class="foo bar"></div>`, {
    classNames: "foo bar",
    html: `<div class="foo bar"></div>`,
  });
  testExtract(
    `<div class="foo bar-baz [boof]:current"></div>`,
    {
      classNames: "foo bar-baz [boof]:current",
      html: `<div class="foo bar-baz [boof]:current"></div>`,
    },
  );
  testExtract(
    `asdf<div class="foo bar-baz [boof]:current"></div>`,
    {
      classNames: "foo bar-baz [boof]:current",
      html: `asdf<div class="foo bar-baz [boof]:current"></div>`,
    },
  );
  testExtract(
    `asdf<div class="foo bar-baz [boof]:current"></div>asdf`,
    {
      classNames: "foo bar-baz [boof]:current",
      html: `asdf<div class="foo bar-baz [boof]:current"></div>asdf`,
    },
  );
  testExtract(
    `<div class="foo bar"></div><span class="baz bar"></span>`,
    {
      classNames: "foo bar baz bar",
      html: `<div class="foo bar"></div><span class="baz bar"></span>`,
    },
  );

  testExtract(
    `<x-foo-bar class="foo bar"></x-foo-bar>`,
    {
      classNames: "foo bar",
      html: `<x-foo-bar class="foo bar"></x-foo-bar>`,
    },
  );
});

Deno.test("extract - encoding", () => {
  testExtract(
    `<div class="[&amp;&gt;.foo]:bold"></div>`,
    {
      classNames: "[&>.foo]:bold",
      html: `<div class="[&amp;&gt;.foo]:bold"></div>`,
    },
    { decodeHtml: true },
  );
});

Deno.test("extract - normalize groups", () => {
  testExtract(`<div class="foo(bar baz)"></div>`, {
    classNames: "foo-bar foo-baz",
    html: `<div class="foo-bar foo-baz"></div>`,
  });

  testExtract(
    `<div class="shadow-lg group-hover:(shadow-xl opacity-70) rounded-lg"></div>`,
    {
      classNames:
        "shadow-lg group-hover:shadow-xl group-hover:opacity-70 rounded-lg",
      html:
        `<div class="shadow-lg group-hover:shadow-xl group-hover:opacity-70 rounded-lg"></div>`,
    },
  );
  testExtract(
    `<div class="border(b green-500)"></div>`,
    {
      classNames: "border-b border-green-500",
      html: `<div class="border-b border-green-500"></div>`,
    },
  );
  testExtract(
    `<a class="border(b green-500) p-3"></a>`,
    {
      classNames: "border-b border-green-500 p-3",
      html: `<a class="border-b border-green-500 p-3"></a>`,
    },
  );
  testExtract(
    `<img class="border(b green-500) p-3"/>`,
    {
      classNames: "border-b border-green-500 p-3",
      html: `<img class="border-b border-green-500 p-3"/>`,
    },
  );

  testExtract(
    `<img class="px(4 sm:6 md:8)"/>`,
    {
      classNames: "px-4 sm:px-6 md:px-8",
      html: `<img class="px-4 sm:px-6 md:px-8"/>`,
    },
  );
  testExtract(
    `<img class="bg(gray-800) rounded"/>`,
    {
      classNames: "bg-gray-800 rounded",
      html: `<img class="bg-gray-800 rounded"/>`,
    },
  );

  testExtract(
    `<img class="py-2 text(5xl sm:5xl lg:6xl gray-900) sm:tracking-tight"/>`,
    {
      classNames:
        "py-2 text-5xl sm:text-5xl lg:text-6xl text-gray-900 sm:tracking-tight",
      html:
        `<img class="py-2 text-5xl sm:text-5xl lg:text-6xl text-gray-900 sm:tracking-tight"/>`,
    },
  );

  testExtract(
    `<img class="focus:(outline-none ring(2 offset-2 green-500))"/>`,
    {
      classNames:
        "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500",
      html:
        `<img class="focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"/>`,
    },
  );

  testExtract(
    `<h2 class="focus:(outline-none ring(2 offset-2 green-500))"></h2>`,
    {
      classNames:
        "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500",
      html:
        `<h2 class="focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"></h2>`,
    },
  );
});
