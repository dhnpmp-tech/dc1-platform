; =============================================================================
; DC1 Provider Daemon — Windows NSIS Installer
; =============================================================================
; Installs to %LOCALAPPDATA%\dc1-provider (NO admin required)
; GUI pages: Welcome → API Key → Run Mode → Schedule → Install → Finish
; Bundles: dc1_daemon.py, dc1-setup-helper.ps1, dc1-uninstall-helper.ps1
; Build:   makensis dc1-provider-Windows.nsi
; =============================================================================

!include "MUI2.nsh"
!include "nsDialogs.nsh"
!include "LogicLib.nsh"
!include "WinMessages.nsh"

; --------------- General Settings ---------------
Name "DC1 Provider Setup"
OutFile "dc1-provider-setup-Windows.exe"
InstallDir "$LOCALAPPDATA\dc1-provider"
RequestExecutionLevel user
Unicode True

; Brand
!define MUI_ICON "${NSISDIR}\Contrib\Graphics\Icons\modern-install.ico"
!define MUI_UNICON "${NSISDIR}\Contrib\Graphics\Icons\modern-uninstall.ico"
!define PRODUCT_NAME "DC1 Provider Daemon"
!define PRODUCT_PUBLISHER "DC1"
!define DASHBOARD_URL "http://76.13.179.86:8083/provider"

; --------------- Variables ---------------
Var API_KEY
Var RUN_MODE          ; "always-on" | "scheduled" | "manual"
Var SCHED_START
Var SCHED_END

; Dialog handles
Var hApiKeyDlg
Var hApiKeyInput
Var hRunModeDlg
Var hRadioAlways
Var hRadioScheduled
Var hRadioManual
Var hSchedDlg
Var hStartTimeInput
Var hEndTimeInput

; --------------- Pages ---------------
; 1. Welcome
!define MUI_WELCOMEPAGE_TITLE "Install the DC1 Provider Daemon"
!define MUI_WELCOMEPAGE_TEXT "This wizard will install the DC1 Provider Daemon on your computer.$\r$\n$\r$\nYour GPU will start earning DC1 credits automatically.$\r$\n$\r$\nNo admin privileges required.$\r$\nClick Next to continue."
!insertmacro MUI_PAGE_WELCOME

; 2. API Key (custom)
Page custom ApiKeyPageCreate ApiKeyPageLeave

; 3. Run Mode (custom)
Page custom RunModePageCreate RunModePageLeave

; 4. Schedule (custom — conditional)
Page custom SchedulePageCreate SchedulePageLeave

; 5. Install
!insertmacro MUI_PAGE_INSTFILES

; 6. Finish
!define MUI_FINISHPAGE_TITLE "Installation Complete!"
!define MUI_FINISHPAGE_TEXT "Your GPU is now earning.$\r$\n$\r$\nClick 'Open My Dashboard' to view your earnings."
!define MUI_FINISHPAGE_RUN
!define MUI_FINISHPAGE_RUN_TEXT "Open My Dashboard"
!define MUI_FINISHPAGE_RUN_FUNCTION OpenDashboard
!insertmacro MUI_PAGE_FINISH

; Uninstaller pages
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"

; --------------- Init: Parse /KEY= from command line ---------------
Function .onInit
    StrCpy $RUN_MODE "always-on"
    StrCpy $SCHED_START "23:00"
    StrCpy $SCHED_END "07:00"
    StrCpy $API_KEY ""

    ; Parse /KEY=xxx from command line
    ${GetParameters} $0
    ${GetOptions} $0 "/KEY=" $1
    ${IfNot} ${Errors}
        StrCpy $API_KEY $1
    ${EndIf}
FunctionEnd

; --------------- Utility: GetParameters / GetOptions ---------------
; These are provided by NSIS's built-in header
!include "FileFunc.nsh"

; --------------- Page: API Key ---------------
Function ApiKeyPageCreate
    !insertmacro MUI_HEADER_TEXT "Provider API Key" "Enter your DC1 Provider API Key"
    nsDialogs::Create 1018
    Pop $hApiKeyDlg
    ${If} $hApiKeyDlg == error
        Abort
    ${EndIf}

    ${NSD_CreateLabel} 0 0 100% 24u "Your Provider API Key:"
    Pop $0

    ${NSD_CreateText} 0 28u 100% 14u "$API_KEY"
    Pop $hApiKeyInput

    ${NSD_CreateLabel} 0 50u 100% 20u "Found in your onboarding email or provider dashboard."
    Pop $0
    SetCtlColors $0 0x666666 transparent

    nsDialogs::Show
FunctionEnd

Function ApiKeyPageLeave
    ${NSD_GetText} $hApiKeyInput $API_KEY
    ${If} $API_KEY == ""
        MessageBox MB_ICONEXCLAMATION|MB_OK "Please enter your Provider API Key."
        Abort
    ${EndIf}
FunctionEnd

; --------------- Page: Run Mode ---------------
Function RunModePageCreate
    !insertmacro MUI_HEADER_TEXT "Run Mode" "Choose when your GPU should earn"
    nsDialogs::Create 1018
    Pop $hRunModeDlg
    ${If} $hRunModeDlg == error
        Abort
    ${EndIf}

    ${NSD_CreateLabel} 0 0 100% 16u "Select how you want the daemon to run:"
    Pop $0

    ${NSD_CreateRadioButton} 10u 24u 95% 12u "Always On (Recommended) — Runs whenever your PC is on"
    Pop $hRadioAlways

    ${NSD_CreateRadioButton} 10u 44u 95% 12u "Scheduled — Runs during specific hours (e.g. overnight)"
    Pop $hRadioScheduled

    ${NSD_CreateRadioButton} 10u 64u 95% 12u "Manual — You control when it runs"
    Pop $hRadioManual

    ; Default selection
    ${If} $RUN_MODE == "scheduled"
        ${NSD_Check} $hRadioScheduled
    ${ElseIf} $RUN_MODE == "manual"
        ${NSD_Check} $hRadioManual
    ${Else}
        ${NSD_Check} $hRadioAlways
    ${EndIf}

    nsDialogs::Show
FunctionEnd

Function RunModePageLeave
    ${NSD_GetState} $hRadioAlways $0
    ${If} $0 == ${BST_CHECKED}
        StrCpy $RUN_MODE "always-on"
    ${EndIf}

    ${NSD_GetState} $hRadioScheduled $0
    ${If} $0 == ${BST_CHECKED}
        StrCpy $RUN_MODE "scheduled"
    ${EndIf}

    ${NSD_GetState} $hRadioManual $0
    ${If} $0 == ${BST_CHECKED}
        StrCpy $RUN_MODE "manual"
    ${EndIf}
FunctionEnd

; --------------- Page: Schedule (conditional) ---------------
Function SchedulePageCreate
    ; Only show if scheduled mode
    ${If} $RUN_MODE != "scheduled"
        Abort  ; Skip this page
    ${EndIf}

    !insertmacro MUI_HEADER_TEXT "Schedule" "Set your earning hours"
    nsDialogs::Create 1018
    Pop $hSchedDlg
    ${If} $hSchedDlg == error
        Abort
    ${EndIf}

    ${NSD_CreateLabel} 0 0 100% 16u "Set the hours when your GPU should earn (24-hour format):"
    Pop $0

    ${NSD_CreateLabel} 0 26u 40% 12u "Start Time (HH:MM):"
    Pop $0
    ${NSD_CreateText} 42% 24u 25% 14u "$SCHED_START"
    Pop $hStartTimeInput

    ${NSD_CreateLabel} 0 50u 40% 12u "End Time (HH:MM):"
    Pop $0
    ${NSD_CreateText} 42% 48u 25% 14u "$SCHED_END"
    Pop $hEndTimeInput

    ${NSD_CreateLabel} 0 76u 100% 20u "Example: Start 23:00, End 07:00 = daemon runs overnight."
    Pop $0
    SetCtlColors $0 0x666666 transparent

    nsDialogs::Show
FunctionEnd

Function SchedulePageLeave
    ${NSD_GetText} $hStartTimeInput $SCHED_START
    ${NSD_GetText} $hEndTimeInput $SCHED_END
FunctionEnd

; --------------- Dashboard launcher ---------------
Function OpenDashboard
    ExecShell "open" "${DASHBOARD_URL}?key=$API_KEY"
FunctionEnd

; ===================== INSTALL SECTION =====================
Section "Install"
    SetOutPath "$INSTDIR"

    ; Bundle files
    File "dc1_daemon.py"
    File "dc1-setup-helper.ps1"
    File "dc1-uninstall-helper.ps1"

    ; Run the setup helper with user selections
    DetailPrint "Running DC1 setup (detecting Python, configuring daemon)..."
    nsExec::ExecToLog 'powershell -ExecutionPolicy Bypass -File "$INSTDIR\dc1-setup-helper.ps1" -ApiKey "$API_KEY" -RunMode "$RUN_MODE" -ScheduledStart "$SCHED_START" -ScheduledEnd "$SCHED_END" -InstallDir "$INSTDIR"'
    Pop $0
    DetailPrint "Setup helper exit code: $0"

    ; Abort installer on setup failure — prevents broken installed state
    IntCmp $0 0 setup_ok setup_failed setup_failed
    setup_failed:
        MessageBox MB_OK|MB_ICONSTOP "Installation failed (exit code $0).$\n$\nCheck the log at:$\n$INSTDIR\install.log$\n$\nCommon causes: Python download failed, pip install error, or no internet connection."
        RMDir /r "$INSTDIR"
        Quit
    setup_ok:

    ; Write uninstaller
    WriteUninstaller "$INSTDIR\uninstall.exe"

    ; Registry (HKCU — no admin needed)
    WriteRegStr HKCU "Software\DC1Provider" "InstallLocation" "$INSTDIR"
    WriteRegStr HKCU "Software\DC1Provider" "ApiKey" "$API_KEY"
    WriteRegStr HKCU "Software\DC1Provider" "RunMode" "$RUN_MODE"

    ; Add/Remove Programs entry (HKCU)
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\DC1Provider" "DisplayName" "${PRODUCT_NAME}"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\DC1Provider" "UninstallString" "$INSTDIR\uninstall.exe"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\DC1Provider" "Publisher" "${PRODUCT_PUBLISHER}"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\DC1Provider" "InstallLocation" "$INSTDIR"
SectionEnd

; ===================== UNINSTALL SECTION =====================
Section "Uninstall"
    ; Stop and remove scheduled task
    nsExec::ExecToLog 'schtasks /End /TN "DC1ProviderDaemon"'
    nsExec::ExecToLog 'schtasks /Delete /TN "DC1ProviderDaemon" /F'

    ; Run uninstall helper if present
    IfFileExists "$INSTDIR\dc1-uninstall-helper.ps1" 0 +2
        nsExec::ExecToLog 'powershell -ExecutionPolicy Bypass -File "$INSTDIR\dc1-uninstall-helper.ps1"'

    ; Remove desktop shortcut
    Delete "$DESKTOP\DC1 - My Earnings.bat"

    ; Remove install directory
    RMDir /r "$INSTDIR"

    ; Remove registry keys
    DeleteRegKey HKCU "Software\DC1Provider"
    DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\DC1Provider"
SectionEnd
