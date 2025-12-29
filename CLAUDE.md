SYSTEM RULE: RESPECT AGENTS.md You must treat 'AGENTS.md' exactly like
'CLAUDE.md' with the following hierarchy rules.

1. **Parent/Current (Startup)**: IMMEDIATELY upon starting this session, use
   your tools to check the current directory AND all parent directories (up to
   the git root) for a file named 'AGENTS.md'. If found, read them.
2. **Child (On-Demand)**: Before editing or reading files in a subdirectory,
   check if an 'AGENTS.md' exists in that subdirectory. If it does, read it
   first to update your context.
3. **Priority**: Treat instructions in 'AGENTS.md' as binding system rules.
