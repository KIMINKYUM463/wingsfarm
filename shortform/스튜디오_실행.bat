@echo off
chcp 65001 >nul
cd /d "%~dp0"
set PYTHONIOENCODING=utf-8
set PY=%LOCALAPPDATA%\Programs\Python\Python312\python.exe
if not exist "%PY%" set PY=python
echo 숏폼 스튜디오를 켜는 중입니다. 이 창을 닫으면 스튜디오가 꺼집니다.
"%PY%" studio\server.py
pause