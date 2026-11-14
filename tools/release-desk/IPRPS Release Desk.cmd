@echo off
rem IPRPS Release Desk: starts the Desk in Debian (WSL) and opens it in your browser.
rem Keep this window open while you use the Desk; closing it stops the Desk.
title IPRPS Release Desk
echo Starting the IPRPS Release Desk in Debian...
wsl -d Debian -u root -- bash -lc "if [ -x /usr/local/bin/iprps-desk ]; then exec /usr/local/bin/iprps-desk web; else exec bash /mnt/g/IPRPS/iprps-os/tools/release-desk/iprps-desk web; fi"
echo.
echo The Desk has stopped.
pause
