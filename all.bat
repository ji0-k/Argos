@echo off
start "Flask Backend" cmd /k "cd /d C:\Argos\backend && set PORT=5001 && python app.py"
start "React Frontend" cmd /k "cd /d C:\Argos\frontend && npm start"
