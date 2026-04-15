@echo off
REM Quick release script - calls the Node.js release script from project root
cd ..
node release-tools/release.mjs %*
