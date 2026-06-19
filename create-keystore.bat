@echo off
echo Creating keystore file for Alo Jetk app...

keytool -genkey ^
  -v ^
  -keystore jetk-release-key.keystore ^
  -alias jetk ^
  -keyalg RSA ^
  -keysize 2048 ^
  -validity 10000 ^
  -storepass jetk123 ^
  -keypass jetk123 ^
  -dname "CN=Alo Jetk,OU=Mobile,O=Jetk,L=Jenin,S=West Bank,C=PS"

if %ERRORLEVEL% EQU 0 (
  echo.
  echo Keystore created successfully!
  echo Location: jetk-release-key.keystore
  echo Password: jetk123
  echo Alias: jetk
  echo.
) else (
  echo.
  echo Failed to create keystore. Make sure Java is installed and in your PATH.
  echo.
)

pause