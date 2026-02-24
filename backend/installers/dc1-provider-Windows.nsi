!include "MUI2.nsh"
Name "DC1 Provider Setup"
OutFile "dc1-provider-setup-Windows.exe"
InstallDir "$PROGRAMFILES\DC1"
RequestExecutionLevel admin
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

Section "Install"
    SetOutPath "$INSTDIR"
    File "daemon.sh"
    File "config.template"
    File "install-deps.ps1"
    CreateDirectory "$SMPROGRAMS\DC1"
    CreateShortcut "$SMPROGRAMS\DC1\Uninstall.lnk" "$INSTDIR\uninstall.exe"
    WriteRegStr HKLM "Software\DC1Provider" "InstallLocation" "$INSTDIR"
    WriteUninstaller "$INSTDIR\uninstall.exe"
SectionEnd

Section "Install Dependencies"
    SetOutPath "$INSTDIR"
    nsExec::ExecToLog 'powershell -ExecutionPolicy Bypass -File "$INSTDIR\install-deps.ps1"'
    nsExec::ExecToLog 'powershell -ExecutionPolicy Bypass -File "$INSTDIR\daemon.sh"'
SectionEnd

Section "Uninstall"
    RMDir /r "$INSTDIR"
    RMDir /r "$SMPROGRAMS\DC1"
    DeleteRegKey HKLM "Software\DC1Provider"
SectionEnd
