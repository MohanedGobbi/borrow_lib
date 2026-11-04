@echo off
rem Sends this installation folder from a Windows computer to the library server over SSH,
rem then runs the chosen script there. Needs the OpenSSH client (built into Windows 10 and 11).
setlocal EnableDelayedExpansion
cd /d "%~dp0"

echo.
echo   Faculty of Law library - send the installation files to the server
echo   ------------------------------------------------------------------
echo   You need the server's address and a Linux account on it that may use sudo.
echo.

where ssh >nul 2>nul
if errorlevel 1 (
  echo   The OpenSSH client is missing. Install it from
  echo   Settings ^> Apps ^> Optional features ^> Add a feature ^> OpenSSH Client
  pause
  exit /b 1
)

set "TARBALL="
for %%F in (lib-borrow-*.tar.gz) do set "TARBALL=%%F"
if not defined TARBALL (
  echo   lib-borrow-*.tar.gz is not in this folder.
  pause
  exit /b 1
)

echo   What should run on the server?
echo     1^) Install the platform  ^(first time^)
echo     2^) Update to this version
echo     3^) Check the platform's status
set /p "ACTION=  Choose 1, 2 or 3: "
if "%ACTION%"=="1" set "SCRIPT=install.sh"
if "%ACTION%"=="2" set "SCRIPT=update.sh"
if "%ACTION%"=="3" set "SCRIPT=status.sh"
if not defined SCRIPT (
  echo   Answer 1, 2 or 3.
  pause
  exit /b 1
)

echo.
set /p "SERVER=  Server address (IP or name): "
set /p "SUSER=  Linux user name on the server: "
if "%SERVER%"=="" exit /b 1
if "%SUSER%"=="" exit /b 1

set "DEST=library-install-%RANDOM%%RANDOM%"
echo.
echo   Copying the files to %SERVER% ^(folder ~/%DEST%^)
echo   ^(you will be asked for the password of %SUSER%^)
scp -o StrictHostKeyChecking=accept-new -q "%TARBALL%" SHA256SUMS.txt install.sh update.sh status.sh "%SUSER%@%SERVER%:"
if errorlevel 1 (
  echo   Copying failed. Check the address, the user name and the password.
  pause
  exit /b 1
)

echo.
echo   Running %SCRIPT% on the server ^(the password may be asked again, then for sudo^)
ssh -t "%SUSER%@%SERVER%" "mkdir -p ~/%DEST% && mv ~/%TARBALL% ~/SHA256SUMS.txt ~/install.sh ~/update.sh ~/status.sh ~/%DEST%/ && cd ~/%DEST% && sudo bash %SCRIPT%"

echo.
pause
