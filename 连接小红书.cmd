@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist ".tools\python\Scripts\xhs.exe" (
  echo 尚未安装小红书 CLI。请先运行：python -m venv .tools/python
  echo 然后运行：.tools\python\Scripts\python.exe -m pip install xiaohongshu-cli==0.6.4
  pause
  exit /b 1
)
echo 请用小红书 App 扫描工具显示的二维码。完成后回网站检查连接。
".tools\python\Scripts\xhs.exe" login --qrcode
pause
