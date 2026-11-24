Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")

' Diretório base onde o arquivo VBS está localizado
ScriptDir = FSO.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = ScriptDir

' 1. Verifica se o servidor local já está ativo na porta 4567
IsRunning = False
On Error Resume Next
Set HttpCheck = CreateObject("MSXML2.ServerXMLHTTP.6.0")
HttpCheck.Open "GET", "http://127.0.0.1:4567/api/dashboard", False
HttpCheck.setTimeouts 800, 800, 800, 800
HttpCheck.Send
If Err.Number = 0 Then
    If HttpCheck.Status = 200 Then
        IsRunning = True
    End If
End If
On Error Goto 0
Set HttpCheck = Nothing

' 2. Se o servidor não estiver rodando, inicia o Node.js em modo 100% oculto (0 = Sem janela CMD)
If Not IsRunning Then
    ProgramFiles = WshShell.ExpandEnvironmentStrings("%ProgramFiles%")
    ProgramFilesX86 = WshShell.ExpandEnvironmentStrings("%ProgramFiles(x86)%")

    NodeExe = ""
    NodeFound = False
    
    If FSO.FileExists(ProgramFiles & "\nodejs\node.exe") Then
        NodeExe = ProgramFiles & "\nodejs\node.exe"
        NodeFound = True
    ElseIf FSO.FileExists(ProgramFilesX86 & "\nodejs\node.exe") Then
        NodeExe = ProgramFilesX86 & "\nodejs\node.exe"
        NodeFound = True
    Else
        ' Testa se o comando "node" está no PATH global
        Ret = WshShell.Run("cmd.exe /c where node >nul 2>nul", 0, True)
        If Ret = 0 Then
            NodeExe = "node"
            NodeFound = True
        End If
    End If

    If Not NodeFound Then
        MsgBox "O Node.js não foi encontrado neste computador!" & vbCrLf & vbCrLf & _
               "Para rodar o sistema pela primeira vez, execute o arquivo:" & vbCrLf & _
               "'1-INSTALAR_NODEJS.bat' dentro da pasta do sistema.", vbExclamation, "Power Tech - Node.js Necessário"
        WScript.Quit 1
    End If

    ServerScript = ScriptDir & "\server\index.js"
    ServerCmd = Chr(34) & NodeExe & Chr(34) & " " & Chr(34) & ServerScript & Chr(34)
    
    ' Executa o servidor Node de forma totalmente invisível (0 = Janela Oculta)
    WshShell.Run ServerCmd, 0, False
    
    ' Aguarda até 5 segundos para o servidor responder
    For i = 1 To 10
        WScript.Sleep 500
        On Error Resume Next
        Set HttpWait = CreateObject("MSXML2.ServerXMLHTTP.6.0")
        HttpWait.Open "GET", "http://127.0.0.1:4567/api/dashboard", False
        HttpWait.setTimeouts 500, 500, 500, 500
        HttpWait.Send
        If Err.Number = 0 Then
            If HttpWait.Status = 200 Then
                Set HttpWait = Nothing
                Exit For
            End If
        End If
        Set HttpWait = Nothing
        On Error Goto 0
    Next
End If

' 3. Abre a interface no modo Janela de Aplicativo Nativa (Edge ou Chrome)
AppUrl = "http://127.0.0.1:4567"
Launched = False

Edge1 = WshShell.ExpandEnvironmentStrings("%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe")
Edge2 = WshShell.ExpandEnvironmentStrings("%ProgramFiles%\Microsoft\Edge\Application\msedge.exe")
Edge3 = WshShell.ExpandEnvironmentStrings("%LocalAppData%\Microsoft\Edge\Application\msedge.exe")

If FSO.FileExists(Edge1) Then
    WshShell.Run Chr(34) & Edge1 & Chr(34) & " --app=" & AppUrl, 1, False
    Launched = True
ElseIf FSO.FileExists(Edge2) Then
    WshShell.Run Chr(34) & Edge2 & Chr(34) & " --app=" & AppUrl, 1, False
    Launched = True
ElseIf FSO.FileExists(Edge3) Then
    WshShell.Run Chr(34) & Edge3 & Chr(34) & " --app=" & AppUrl, 1, False
    Launched = True
End If

If Not Launched Then
    Chrome1 = WshShell.ExpandEnvironmentStrings("%ProgramFiles%\Google\Chrome\Application\chrome.exe")
    Chrome2 = WshShell.ExpandEnvironmentStrings("%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe")
    Chrome3 = WshShell.ExpandEnvironmentStrings("%LocalAppData%\Google\Chrome\Application\chrome.exe")
    
    If FSO.FileExists(Chrome1) Then
        WshShell.Run Chr(34) & Chrome1 & Chr(34) & " --app=" & AppUrl, 1, False
        Launched = True
    ElseIf FSO.FileExists(Chrome2) Then
        WshShell.Run Chr(34) & Chrome2 & Chr(34) & " --app=" & AppUrl, 1, False
        Launched = True
    ElseIf FSO.FileExists(Chrome3) Then
        WshShell.Run Chr(34) & Chrome3 & Chr(34) & " --app=" & AppUrl, 1, False
        Launched = True
    End If
End If

' Fallback para o navegador padrão caso Edge ou Chrome não existam
If Not Launched Then
    WshShell.Run AppUrl, 1, False
End If

Set WshShell = Nothing
Set FSO = Nothing
