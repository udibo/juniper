import { sortBy } from "@std/collections/sort-by";
import { walk } from "@std/fs";
import * as path from "@std/path";

export interface GeneratedRoute {
  path: string;
  main?: string;
  index?: string;
  catchall?: string;
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

export async function processClientDirectory(
  absoluteDirPath: string,
  importPathBase: string,
  isRootLevel: boolean,
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
      if (isClientMainRoute(entry.name)) {
        properties.main = isRootLevel ? directImport : lazyImport;
      } else if (isClientIndexRoute(entry.name)) {
        properties.index = lazyImport;
      } else if (isClientCatchallRoute(entry.name)) {
        properties.catchall = lazyImport;
      } else if (isClientDynamicRoute(entry.name)) {
        const paramName = getClientDynamicRouteParam(entry.name);
        properties.parameterizedChildren.push({
          path: `:${paramName}`,
          main: lazyImport,
        });
      } else if (isRegularClientFileModule(entry.name)) {
        const routeName = entry.name.slice(0, -4);
        properties.fileModuleChildren.push({
          path: routeName,
          main: lazyImport,
        });
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

export function generatedRouteObjectToString(
  obj: GeneratedRoute | string | GeneratedRoute[],
  indentLevel: number = 0,
): string {
  const indent = "  ".repeat(indentLevel);
  const nextIndent = "  ".repeat(indentLevel + 1);

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
