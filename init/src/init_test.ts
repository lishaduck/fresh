import { expect } from "@std/expect";
import { initProject, InitStep, type MockTTY } from "./init.ts";
import * as path from "@std/path";
import { withBrowser } from "../../tests/test_utils.tsx";
import { waitForText } from "../../tests/test_utils.tsx";
import { withChildProcessServer } from "../../tests/test_utils.tsx";

async function withTmpDir(fn: (dir: string) => void | Promise<void>) {
  const hash = crypto.randomUUID().replaceAll(/-/g, "");
  const dir = path.join(import.meta.dirname!, "..", "..", `tmp-${hash}`);
  await Deno.mkdir(dir, { recursive: true });

  try {
    await fn(dir);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
}

// TODO: Patch project dependencies until there is an easier way
// to link JSR dependencies
async function patchProject(dir: string): Promise<void> {
  const jsonPath = path.join(dir, "deno.json");
  const json = JSON.parse(await Deno.readTextFile(jsonPath));
  const rootJson = JSON.parse(
    await Deno.readTextFile(
      path.join(import.meta.dirname!, "..", "..", "deno.json"),
    ),
  );

  json.imports = rootJson.imports;
  json.imports["fresh"] = "../src/mod.ts";
  json.imports["fresh/dev"] = "../src/dev/mod.ts";
  json.imports["@fresh/plugin-tailwind"] = "../plugin-tailwindcss/mod.ts";

  await Deno.writeTextFile(jsonPath, JSON.stringify(json, null, 2));
}

function mockUserInput(steps: Record<string, unknown>) {
  const errorOutput: unknown[][] = [];
  const tty: MockTTY = {
    confirm(step, _msg) {
      return Boolean(steps[step]);
    },
    prompt(step, _msg, def) {
      const setting = typeof steps[step] === "string"
        ? steps[step] as string
        : null;
      return setting ?? def ?? null;
    },
    log: () => {},
    logError: (...args) => {
      errorOutput.push(args);
    },
  };
  return {
    errorOutput,
    tty,
  };
}

async function expectProjectFile(dir: string, pathname: string) {
  const filePath = path.join(dir, ...pathname.split("/").filter(Boolean));
  const stat = await Deno.stat(filePath);
  if (!stat.isFile) {
    throw new Error(`Not a project file: ${filePath}`);
  }
}

async function readProjectFile(dir: string, pathname: string): Promise<string> {
  const filePath = path.join(dir, ...pathname.split("/").filter(Boolean));
  const content = await Deno.readTextFile(filePath);
  return content;
}

Deno.test("init - new project", async () => {
  await withTmpDir(async (dir) => {
    const mock = mockUserInput({});
    await initProject(dir, [], {}, mock.tty);
  });
});

Deno.test("init - create project dir", async () => {
  await withTmpDir(async (dir) => {
    const mock = mockUserInput({ [InitStep.ProjectName]: "fresh-init" });
    await initProject(dir, [], {}, mock.tty);

    const root = path.join(dir, "fresh-init");
    await expectProjectFile(root, "deno.json");
    await expectProjectFile(root, "main.ts");
    await expectProjectFile(root, "dev.ts");
    await expectProjectFile(root, ".gitignore");
    await expectProjectFile(root, "static/styles.css");
  });
});

Deno.test("init - with tailwind", async () => {
  await withTmpDir(async (dir) => {
    const mock = mockUserInput({
      [InitStep.ProjectName]: ".",
      [InitStep.Tailwind]: true,
    });
    await initProject(dir, [], {}, mock.tty);

    const css = await readProjectFile(dir, "static/styles.css");
    expect(css).toMatch(/@tailwind/);

    const main = await readProjectFile(dir, "main.ts");
    const dev = await readProjectFile(dir, "dev.ts");
    expect(main).not.toMatch(/tailwind/);
    expect(dev).toMatch(/tailwind/);
  });
});

Deno.test("init - with vscode", async () => {
  await withTmpDir(async (dir) => {
    const mock = mockUserInput({
      [InitStep.ProjectName]: ".",
      [InitStep.VSCode]: true,
    });
    await initProject(dir, [], {}, mock.tty);

    await expectProjectFile(dir, ".vscode/settings.json");
    await expectProjectFile(dir, ".vscode/extensions.json");
  });
});

Deno.test("init - type check project", async () => {
  await withTmpDir(async (dir) => {
    const mock = mockUserInput({
      [InitStep.ProjectName]: ".",
    });
    await initProject(dir, [], {}, mock.tty);
    await expectProjectFile(dir, "main.ts");
    await expectProjectFile(dir, "dev.ts");

    const check = await new Deno.Command(Deno.execPath(), {
      args: ["check", "main.ts", "dev.ts"],
      cwd: dir,
      stderr: "inherit",
      stdout: "inherit",
    }).output();
    expect(check.code).toEqual(0);
  });
});

Deno.test("init - can start dev server", async () => {
  await withTmpDir(async (dir) => {
    const mock = mockUserInput({
      [InitStep.ProjectName]: ".",
    });
    await initProject(dir, [], {}, mock.tty);
    await expectProjectFile(dir, "main.ts");
    await expectProjectFile(dir, "dev.ts");

    await patchProject(dir);
    await withChildProcessServer(
      dir,
      path.join(dir, "dev.ts"),
      async (address) => {
        await withBrowser(async (page) => {
          await page.goto(address);
          await page.locator("button").click();
          await waitForText(page, "button + p", "2");
        });
      },
    );
  });
});

Deno.test("init - can start build project", async () => {
  await withTmpDir(async (dir) => {
    const mock = mockUserInput({
      [InitStep.ProjectName]: ".",
    });
    await initProject(dir, [], {}, mock.tty);
    await expectProjectFile(dir, "main.ts");
    await expectProjectFile(dir, "dev.ts");

    await patchProject(dir);

    // Build
    await new Deno.Command(Deno.execPath(), {
      args: ["run", "-A", path.join(dir, "dev.ts"), "build"],
      stdin: "null",
      stdout: "piped",
      stderr: "piped",
      cwd: dir,
    }).output();

    await withChildProcessServer(
      dir,
      path.join(dir, "main.ts"),
      async (address) => {
        await withBrowser(async (page) => {
          await page.goto(address);
          await page.locator("button").click();
          await waitForText(page, "button + p", "2");
        });
      },
    );
  });
});
