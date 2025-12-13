import { sortBy } from "@std/collections/sort-by";
import { walk } from "@std/fs";
import * as path from "@std/path";

export interface ServerFlags {
  loader?: boolean;
  action?: boolean;
}

export interface GeneratedRoute {
  path: string;
  main?: string;
  index?: string;
  catchall?: string;
  server?: ServerFlags;
  serverIndex?: ServerFlags;
  serverCatchall?: ServerFlags;
  children?: GeneratedRoute[];
}

export interface DirRouteProperties {
  main?: string;
  index?: string;
  catchall?: string;
  fileModuleChildren: GeneratedRoute[];
  parameterizedChildren: GeneratedRoute[];
  directoryChildren: GeneratedRoute[];
}

export function isMainRoute(fileName: string): boolean {
  return fileName === "main.ts";
}

export function isIndexRoute(fileName: string): boolean {
  return fileName === "index.ts";
}

export function isCatchallRoute(fileName: string): boolean {
  return fileName === "[...].ts";
}

export function isDynamicRoute(fileName: string): boolean {
  return fileName.startsWith("[") && fileName.endsWith("].ts") &&
    !isCatchallRoute(fileName);
}

export function getDynamicRouteParam(fileName: string): string {
  return fileName.slice(1, -4);
}

export function isDynamicDirName(dirName: string): boolean {
  return dirName.startsWith("[") && dirName.endsWith("]");
}

export function getDynamicDirParam(dirName: string): string {
  return dirName.slice(1, -1);
}

export function isRegularFileModule(fileName: string): boolean {
  return fileName.endsWith(".ts") &&
    !isMainRoute(fileName) &&
    !isIndexRoute(fileName) &&
    !isCatchallRoute(fileName) &&
    !isDynamicRoute(fileName) &&
    !fileName.startsWith("_") &&
    !fileName.includes(".test");
}

export function isClientMainRoute(fileName: string): boolean {
  return fileName === "main.tsx";
}

export function isClientIndexRoute(fileName: string): boolean {
  return fileName === "index.tsx";
}

export function isClientCatchallRoute(fileName: string): boolean {
  return fileName === "[...].tsx";
}

export function isClientDynamicRoute(fileName: string): boolean {
  return fileName.startsWith("[") && fileName.endsWith("].tsx") &&
    !isClientCatchallRoute(fileName);
}

export function getClientDynamicRouteParam(fileName: string): string {
  return fileName.slice(1, -5);
}

export function isRegularClientFileModule(fileName: string): boolean {
  return fileName.endsWith(".tsx") &&
    !isClientMainRoute(fileName) &&
    !isClientIndexRoute(fileName) &&
    !isClientCatchallRoute(fileName) &&
    !isClientDynamicRoute(fileName) &&
    !fileName.startsWith("_") &&
    !fileName.includes(".test");
}

export function getServerRouteFileName(clientFileName: string): string {
  return clientFileName.replace(/\.tsx$/, ".ts");
}

export async function getServerFlags(
  absoluteFilePath: string,
): Promise<ServerFlags | undefined> {
  try {
    const content = await Deno.readTextFile(absoluteFilePath);
    const hasLoader = /export\s+(async\s+)?function\s+loader\b/.test(content) ||
      /export\s+const\s+loader(\s|=|:)/.test(content);
    const hasAction = /export\s+(async\s+)?function\s+action\b/.test(content) ||
      /export\s+const\s+action(\s|=|:)/.test(content);

    if (hasLoader || hasAction) {
      const flags: ServerFlags = {};
      if (hasLoader) flags.loader = true;
      if (hasAction) flags.action = true;
      return flags;
    }
  } catch {
    // File doesn't exist or can't be read
  }
  return undefined;
}

export async function processDirectory(
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
          path: `:${paramName}`,
          main: moduleImport,
        });
      } else if (isRegularFileModule(entry.name)) {
        const routeName = entry.name.slice(0, -3);
        properties.fileModuleChildren.push({
          path: routeName,
          main: moduleImport,
        });
      }
    } else if (entry.isDirectory) {
      if (entry.name.startsWith("_")) continue;

      const subDirAbsolutePath = path.join(absoluteDirPath, entry.name);
      const subDirImportPathBase = `${importPathBase}/${entry.name}`;
      const subDirProps = await processDirectory(
        subDirAbsolutePath,
        subDirImportPathBase,
      );

      const children = [
        ...subDirProps.fileModuleChildren,
        ...subDirProps.directoryChildren,
        ...subDirProps.parameterizedChildren,
      ];

      let routePathSegment = entry.name;
      const isDynamicDir = isDynamicDirName(entry.name);
      if (isDynamicDir) {
        routePathSegment = `:${getDynamicDirParam(entry.name)}`;
      }

      const dirRoute: GeneratedRoute = {
        path: routePathSegment,
      };
      if (subDirProps.main) dirRoute.main = subDirProps.main;
      if (subDirProps.index) dirRoute.index = subDirProps.index;
      if (subDirProps.catchall) dirRoute.catchall = subDirProps.catchall;
      if (children.length > 0) dirRoute.children = children;

      if (isDynamicDir) {
        properties.parameterizedChildren.push(dirRoute);
      } else {
        properties.directoryChildren.push(dirRoute);
      }
    }
  }
  return properties;
}

export interface ClientDirRouteProperties extends DirRouteProperties {
  serverMain?: ServerFlags;
  serverIndex?: ServerFlags;
  serverCatchall?: ServerFlags;
}

export async function processClientDirectory(
  absoluteDirPath: string,
  importPathBase: string,
  isRootLevel: boolean,
): Promise<ClientDirRouteProperties> {
  const properties: ClientDirRouteProperties = {
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
    if (isClientMainRoute(name)) return 0;
    if (isClientIndexRoute(name)) return 1;
    if (isClientCatchallRoute(name)) return 2;
    if (isClientDynamicRoute(name)) return 3;
    return 4;
  };

  dirEntries = sortBy(
    dirEntries,
    (e) => `${e.isFile ? "0" : "1"}-${entryPriority(e.name)}-${e.name}`,
  );

  for (const entry of dirEntries) {
    const currentFileImportPath = `${importPathBase}/${entry.name}`;
    const lazyImport = `() => import("${currentFileImportPath}")`;
    const directImport = `await import("${currentFileImportPath}")`;

    if (entry.isFile && entry.name.endsWith(".tsx")) {
      const serverFileName = getServerRouteFileName(entry.name);
      const serverFilePath = path.join(absoluteDirPath, serverFileName);
      const serverFlags = await getServerFlags(serverFilePath);

      if (isClientMainRoute(entry.name)) {
        properties.main = isRootLevel ? directImport : lazyImport;
        if (serverFlags) properties.serverMain = serverFlags;
      } else if (isClientIndexRoute(entry.name)) {
        properties.index = lazyImport;
        if (serverFlags) properties.serverIndex = serverFlags;
      } else if (isClientCatchallRoute(entry.name)) {
        properties.catchall = lazyImport;
        if (serverFlags) properties.serverCatchall = serverFlags;
      } else if (isClientDynamicRoute(entry.name)) {
        const paramName = getClientDynamicRouteParam(entry.name);
        const route: GeneratedRoute = {
          path: `:${paramName}`,
          main: lazyImport,
        };
        if (serverFlags) route.server = serverFlags;
        properties.parameterizedChildren.push(route);
      } else if (isRegularClientFileModule(entry.name)) {
        const routeName = entry.name.slice(0, -4);
        const route: GeneratedRoute = {
          path: routeName,
          main: lazyImport,
        };
        if (serverFlags) route.server = serverFlags;
        properties.fileModuleChildren.push(route);
      }
    } else if (entry.isDirectory) {
      if (entry.name.startsWith("_")) continue;

      const subDirAbsolutePath = path.join(absoluteDirPath, entry.name);
      const subDirImportPathBase = `${importPathBase}/${entry.name}`;
      const subDirProps = await processClientDirectory(
        subDirAbsolutePath,
        subDirImportPathBase,
        false,
      );

      const children = [
        ...subDirProps.fileModuleChildren,
        ...subDirProps.directoryChildren,
        ...subDirProps.parameterizedChildren,
      ];

      const hasClientRoutes = subDirProps.main || subDirProps.index ||
        subDirProps.catchall || children.length > 0;
      if (!hasClientRoutes) continue;

      let routePathSegment = entry.name;
      const isDynamicDir = isDynamicDirName(entry.name);
      if (isDynamicDir) {
        routePathSegment = `:${getDynamicDirParam(entry.name)}`;
      }

      const dirRoute: GeneratedRoute = {
        path: routePathSegment,
      };
      if (subDirProps.main) dirRoute.main = subDirProps.main;
      if (subDirProps.serverMain) dirRoute.server = subDirProps.serverMain;
      if (subDirProps.index) dirRoute.index = subDirProps.index;
      if (subDirProps.serverIndex) {
        dirRoute.serverIndex = subDirProps.serverIndex;
      }
      if (subDirProps.catchall) dirRoute.catchall = subDirProps.catchall;
      if (subDirProps.serverCatchall) {
        dirRoute.serverCatchall = subDirProps.serverCatchall;
      }
      if (children.length > 0) dirRoute.children = children;

      if (isDynamicDir) {
        properties.parameterizedChildren.push(dirRoute);
      } else {
        properties.directoryChildren.push(dirRoute);
      }
    }
  }
  return properties;
}

export function generatedRouteObjectToString(
  obj: GeneratedRoute | ServerFlags | string | boolean | GeneratedRoute[],
  indentLevel: number = 0,
): string {
  const indent = "  ".repeat(indentLevel);
  const nextIndent = "  ".repeat(indentLevel + 1);

  if (typeof obj === "boolean") {
    return obj.toString();
  }
  if (typeof obj === "string") {
    if (obj.startsWith("await import(") || obj.startsWith("() => import(")) {
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
  throw new Error(
    `Unhandled type in generatedRouteObjectToString: ${typeof obj}`,
  );
}
