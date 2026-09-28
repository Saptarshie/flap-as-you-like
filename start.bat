@echo off
title Flappy Flight 3D
cd /d "%~dp0"
echo Starting Flappy Flight 3D...
start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --new-window --window-size=1280,800 "http://localhost:8321" 2>nul || start "" http://localhost:8321
node server.js