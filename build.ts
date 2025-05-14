import { walk } from "@std/fs";
import * as path from "@std/path";
import { sortBy } from "@std/collections/sort-by";
import { toText } from "@std/streams";
interface GeneratedRoute {
  path: string;
  main?: string;
  index?: string;
  catchall?: string;
  children?: GeneratedRoute[];
}

interface DirRouteProperties {
  main?: string;
  index?: string;
  catchall?: string;
  fileModuleChildren: GeneratedRoute[];
  parameterizedChildren: GeneratedRoute[];
  directoryChildren: GeneratedRoute[];
}

function isMainRoute(fileName: string): boolean {
  return fileName === "main.ts";
}

function isIndexRoute(fileName: string): boolean {
  return fileName === "index.ts";
}

function isCatchallRoute(fileName: string): boolean {
  return fileName === "[...].ts";
}

function isDynamicRoute(fileName: string): boolean {
  return fileName.startsWith("[") && fileName.endsWith("].ts") &&
    !isCatchallRoute(fileName);
}

function getDynamicRouteParam(fileName: string): string {
  return fileName.slice(1, -4);
}

function isDynamicDirName(dirName: string): boolean {
  return dirName.startsWith("[") && dirName.endsWith("]");
}

function getDynamicDirParam(dirName: string): string {
  return dirName.slice(1, -1);
}

function isRegularFileModule(fileName: string): boolean {
  return fileName.endsWith(".ts") &&
    !isMainRoute(fileName) &&
    !isIndexRoute(fileName) &&
    !isCatchallRoute(fileName) &&
    !isDynamicRoute(fileName) &&
    !fileName.startsWith("_") &&
    !fileName.includes(".test");
}

async function processDirectory(
  absoluteDirPath: string,
  importPathBase: string,
): Promise<DirRouteProperties> {
  const properties: DirRouteProperties = {
    fileModuleChildren: [],
    parameterizedChildren: [],
    directoryChildren: [],
  };

  let dirEntries = [];
  let firstEntrySkipped = false;
  for await (
    const entry of walk(absoluteDirPath, {
      maxDepth: 1,
      includeDirs: true,
      includeFiles: true,
      followSymlinks: false,
    })
  ) {
    if (!firstEntrySkipped) {
      firstEntrySkipped = true;
      continue;
    }
    dirEntries.push(entry);
  }

  const entryPriority = (name: string): number => {
    if (isMainRoute(name)) return 0;
    if (isIndexRoute(name)) return 1;
    if (isCatchallRoute(name)) return 2;
    if (isDynamicRoute(name)) return 3;
    return 4;
  };

  dirEntries = sortBy(
    dirEntries,
    (e) => `${e.isFile ? "0" : "1"}-${entryPriority(e.name)}-${e.name}`,
  );

  for (const entry of dirEntries) {
    const currentFileImportPath = `${importPathBase}/${entry.name}`;
    const moduleImport = `await import("${currentFileImportPath}")`;

    if (entry.isFile && entry.name.endsWith(".ts")) {
      if (isMainRoute(entry.name)) {
        properties.main = moduleImport;
      } else if (isIndexRoute(entry.name)) {
        properties.index = moduleImport;
      } else if (isCatchallRoute(entry.name)) {
        properties.catchall = moduleImport;
      } else if (isDynamicRoute(entry.name)) {
        const paramName = getDynamicRouteParam(entry.name);
        properties.parameterizedChildren.push({
          path: `/:${paramName}`,
          main: moduleImport,
        });
      } else if (isRegularFileModule(entry.name)) {
        const routeName = entry.name.slice(0, -3);
        properties.fileModuleChildren.push({
          path: `/${routeName}`,
          main: moduleImport,
        });
      }
    } else if (entry.isDirectory) {
      // Skip conventionally private directories like _components, _utils, etc.
      if (entry.name.startsWith("_")) continue;

      const subDirAbsolutePath = path.join(absoluteDirPath, entry.name);
      const subDirImportPathBase = `${importPathBase}/${entry.name}`;
      const subDirProps = await processDirectory(
        subDirAbsolutePath,
        subDirImportPathBase,
      );

      const children = [
        ...subDirProps.fileModuleChildren,
        ...subDirProps.parameterizedChildren,
        ...subDirProps.directoryChildren,
      ].sort((a, b) => a.path.localeCompare(b.path));

      let routePathSegment = entry.name;
      if (isDynamicDirName(entry.name)) {
        routePathSegment = `:${getDynamicDirParam(entry.name)}`;
      }

      const dirRoute: GeneratedRoute = {
        path: `/${routePathSegment}`,
      };
      if (subDirProps.main) dirRoute.main = subDirProps.main;
      if (subDirProps.index) dirRoute.index = subDirProps.index;
      if (subDirProps.catchall) dirRoute.catchall = subDirProps.catchall;
      if (children.length > 0) dirRoute.children = children;

      properties.directoryChildren.push(dirRoute);
    }
  }
  return properties;
}

function generatedRouteObjectToString(
  obj: GeneratedRoute | string | GeneratedRoute[],
  indentLevel: number = 0,
): string {
  const indent = "  ".repeat(indentLevel);
  const nextIndent = "  ".repeat(indentLevel + 1);

  if (typeof obj === "string") {
    if (obj.startsWith("await import(")) {
      return obj;
    }
    return `"${
      obj.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")
    }"`;
  }
  if (Array.isArray(obj)) {
    const arrElements = obj.map((item) =>
      generatedRouteObjectToString(item, indentLevel + 1)
    ).join(`,\n${nextIndent}`);
    return `[\n${nextIndent}${arrElements}\n${indent}]`;
  }
  if (typeof obj === "object" && obj !== null) {
    const props = Object.entries(obj)
      .filter(([, value]) => {
        return value !== undefined;
      })
      .map(([key, value]) =>
        `${nextIndent}${key}: ${
          generatedRouteObjectToString(value, indentLevel + 1)
        }`
      )
      .join(",\n");

    return `{\n${props}\n${indent}}`;
  }
  // Fallback for type checking, should be unreachable with correct input types
  throw new Error(
    `Unhandled type in generatedRouteObjectToString: ${typeof obj}`,
  );
}

const fmtCommand = new Deno.Command(Deno.execPath(), {
  args: ["fmt", "-"],
  stdin: "piped",
  stdout: "piped",
});

export async function buildMainFile(projectRoot: string): Promise<string> {
  const routesDirScanningRoot = path.resolve(projectRoot, "./routes");
  const importPrefixForRoutes = "./routes";

  const rootDirProperties = await processDirectory(
    routesDirScanningRoot,
    importPrefixForRoutes,
  );

  const allRootChildren = [
    ...rootDirProperties.fileModuleChildren,
    ...rootDirProperties.parameterizedChildren,
    ...rootDirProperties.directoryChildren,
  ].sort((a, b) => a.path.localeCompare(b.path));

  const finalRoutesConfig: GeneratedRoute = {
    path: "/",
  };
  if (rootDirProperties.main) finalRoutesConfig.main = rootDirProperties.main;
  if (rootDirProperties.index) {
    finalRoutesConfig.index = rootDirProperties.index;
  }
  if (rootDirProperties.catchall) {
    finalRoutesConfig.catchall = rootDirProperties.catchall;
  }
  if (allRootChildren.length > 0) {
    finalRoutesConfig.children = allRootChildren;
  }

  const routesConfigString = generatedRouteObjectToString(finalRoutesConfig, 1);

  const fmt = fmtCommand.spawn();
  const fmtWriter = fmt.stdin.getWriter();
  const encoder = new TextEncoder();
  fmtWriter.write(encoder.encode(`\
// This file is auto-generated by @udibo/juniper/build
// Do not edit this file directly.

import { createApp } from "@udibo/juniper/server";

export const app = createApp(import.meta.url, ${routesConfigString});

if (import.meta.main) {
  Deno.serve(app.fetch);
}
`));
  fmtWriter.close();
  const { success, code } = await fmt.status;
  if (!success) {
    throw new Error(`Failed to format generated file: ${code}`);
  }

  let formattedOutput = await toText(fmt.stdout);
  formattedOutput = formattedOutput.replace(/\r\n/g, "\n");
  return formattedOutput;
}
