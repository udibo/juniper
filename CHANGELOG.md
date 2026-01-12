# [0.2.0](https://github.com/udibo/juniper/compare/0.1.2...0.2.0) (2026-01-12)


### Bug Fixes

* Move provider in shared layout in tanstack template ([afb1f24](https://github.com/udibo/juniper/commit/afb1f24df1c17ea5e54bbdc36f592fad7d98034a))
* Normalize ignorePaths for dev server ([c2bde40](https://github.com/udibo/juniper/commit/c2bde4075b229375e4e02eb4afb697de3300c159))


### Features

* Add ignorePaths build configuration option ([e6009f3](https://github.com/udibo/juniper/commit/e6009f3230cd8f329c9c14fa1505def826c7d80b))
* Return json for not found urls with file extensions ([29b0318](https://github.com/udibo/juniper/commit/29b0318ed93b313029dbdbf074ef05d34ba55036))
* Update changelog and test semantic release ([#64](https://github.com/udibo/juniper/issues/64)) ([9289fe1](https://github.com/udibo/juniper/commit/9289fe15ab99869599440b1e2efc2eb4b549984d))
* Use cbor2 for all server state serialization instead of SuperJSON ([ff57ee7](https://github.com/udibo/juniper/commit/ff57ee794248615076a8fc0c05595637bbcfa5c6))

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
