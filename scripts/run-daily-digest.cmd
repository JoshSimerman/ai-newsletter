@echo off
rem Sift daily digest launcher for Windows Task Scheduler.
rem Runs Claude Code headless with the kickoff prompt from the repo root.
rem The log lives outside tmp\ because the pipeline wipes tmp\ at the start of each fresh run.
rem Set CLAUDE_EXE to a full path if `claude` is not on the scheduler's PATH.
cd /d "%~dp0.."
if not defined CLAUDE_EXE set "CLAUDE_EXE=claude"
echo ===== Sift run %DATE% %TIME% ===== >> daily-run.log
"%CLAUDE_EXE%" -p "Generate the next Sift edition. Read instructions/DAILY-DIGEST-CREATOR.md and execute the full pipeline - research, assemble, publish. No questions, no confirmations, just run it." --dangerously-skip-permissions >> daily-run.log 2>&1
echo ===== exit %ERRORLEVEL% ===== >> daily-run.log
