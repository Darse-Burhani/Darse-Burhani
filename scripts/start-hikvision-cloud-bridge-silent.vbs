' ==============================================================================
' Darse Burhani — Hikvision Cloud Bridge Silent 24/7 Daemon
' ==============================================================================
' Runs the bridge completely in the background without showing a command window.
' ==============================================================================
Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "c:\Users\Hatim Bhai Mithai\Documents\Darse-Burhani"
WshShell.Run Chr(34) & "c:\Users\Hatim Bhai Mithai\Documents\Darse-Burhani\scripts\start-hikvision-cloud-bridge.bat" & Chr(34), 0, False
Set WshShell = Nothing
