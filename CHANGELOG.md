# Changelog

All notable changes are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

- Declared mirror roots with listing and per-root configuration.
- Note lifecycle against a Notion mirror: get, update, move, delete, touch, and status.
- Preflight checks for note and tree operations before any write.
- Tree pruning and deletion, with exclusions and content hashing to detect drift.
