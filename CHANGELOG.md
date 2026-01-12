# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-01-12

- feat: Use cbor2 for all server state serialization instead of SuperJSON
  (https://github.com/udibo/juniper/pull/63)
- feat: Return json for not found urls with file extensions
- feat: Add ignorePaths build configuration option
- fix: Move provider in shared layout in tanstack template
- docs: Improve styling guide for TailwindCSS

## [0.1.2] - 2026-01-05

### Added

- Add automatic cache control headers for build artifacts. `main.js` uses
  `no-cache` with ETag validation to prevent CDN caching while allowing browser
  cache validation. Other build files use `public, max-age=14400` (4 hours).

## [0.1.1] - 2026-01-02

### Fixed

- Fix dev server not finding builder.

## [0.1.0] - 2026-01-01

This is the first minor release of Juniper.
