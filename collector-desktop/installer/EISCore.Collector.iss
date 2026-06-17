#ifndef AppVersion
#define AppVersion "0.1.0"
#endif

#ifndef SourceDir
#define SourceDir "..\artifacts\publish\EISCore.Collector-0.1.0-win-x64"
#endif

#ifndef OutputDir
#define OutputDir "..\artifacts\installer"
#endif

#ifndef OutputBaseFilename
#define OutputBaseFilename "EISCore.Collector-0.1.0-win-x64-setup"
#endif

#ifndef AppPublisher
#define AppPublisher "EISCore"
#endif

#ifndef AppUrl
#define AppUrl "https://nanpai.eissys.top"
#endif

#define AppName "EISCore Collector"
#define AppExeName "EISCore.Collector.exe"

[Setup]
AppId={{D7F10C50-AD26-4D57-85CB-CB4AAEA36347}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL={#AppUrl}
AppSupportURL={#AppUrl}
AppUpdatesURL={#AppUrl}
DefaultDirName={autopf}\EISCore\Collector
DefaultGroupName=EISCore
DisableProgramGroupPage=yes
OutputDir={#OutputDir}
OutputBaseFilename={#OutputBaseFilename}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
CloseApplications=yes
CloseApplicationsFilter={#AppExeName}
RestartApplications=no
UninstallDisplayName={#AppName}
UninstallDisplayIcon={app}\{#AppExeName}
PrivilegesRequired=admin
SetupLogging=yes

[Languages]
Name: "chinesesimp"; MessagesFile: "compiler:Languages\ChineseSimplified.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "startup"; Description: "安装后启用开机自启"; GroupDescription: "采集端"; Flags: unchecked

[Files]
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\EISCore Collector"; Filename: "{app}\{#AppExeName}"
Name: "{group}\卸载 EISCore Collector"; Filename: "{uninstallexe}"
Name: "{autodesktop}\EISCore Collector"; Filename: "{app}\{#AppExeName}"; Tasks: desktopicon

[Registry]
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "EISCore Collector"; ValueData: """{app}\{#AppExeName}"""; Flags: uninsdeletevalue; Tasks: startup

[Run]
Filename: "{app}\{#AppExeName}"; Description: "启动 EISCore Collector"; Flags: nowait postinstall skipifsilent
