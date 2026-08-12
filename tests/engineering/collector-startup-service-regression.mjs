// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const localDotnet = '/home/lzr/.dotnet/dotnet'
const dotnet = process.env.DOTNET_ROOT
  ? join(process.env.DOTNET_ROOT, 'dotnet')
  : existsSync(localDotnet)
    ? localDotnet
    : 'dotnet'
const workDir = mkdtempSync(join(tmpdir(), 'eiscore-startup-service-'))

const project = join(workDir, 'CollectorStartupServiceSmoke.csproj')
const startupService = resolve(repoRoot, 'collector-desktop/EISCore.Collector/Services/StartupService.cs')
const autoStartPolicy = resolve(repoRoot, 'collector-desktop/EISCore.Collector/Services/CollectorAutoStartPolicy.cs')

writeFileSync(project, `\
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net7.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <LangVersion>latest</LangVersion>
    <EnableDefaultCompileItems>false</EnableDefaultCompileItems>
  </PropertyGroup>
  <ItemGroup>
    <Compile Include="${startupService}" Link="StartupService.cs" />
    <Compile Include="${autoStartPolicy}" Link="CollectorAutoStartPolicy.cs" />
    <Compile Include="Program.cs" />
  </ItemGroup>
</Project>
`)

writeFileSync(join(workDir, 'Program.cs'), String.raw`
using EISCore.Collector.Services;

var exePath = @"C:\Users\Alice\AppData\Local\Programs\EISCore Collector\EISCore.Collector.exe";
var command = StartupService.BuildRunCommand(exePath);
if (command != $"\"{exePath}\"")
{
    throw new InvalidOperationException($"Unexpected startup command: {command}");
}

var commandWithArguments = StartupService.BuildRunCommand(exePath, "--minimized --from-startup");
if (commandWithArguments != $"\"{exePath}\" --minimized --from-startup")
{
    throw new InvalidOperationException($"Unexpected startup command with arguments: {commandWithArguments}");
}

var startupCommand = StartupService.BuildStartupRunCommand(exePath);
if (startupCommand != $"\"{exePath}\" {StartupService.DefaultStartupArguments}")
{
    throw new InvalidOperationException($"Unexpected default startup command: {startupCommand}");
}

if (!StartupService.IsRunCommandForExecutable(command, exePath))
{
    throw new InvalidOperationException("Quoted command should match its executable path.");
}

if (!StartupService.IsRunCommandForExecutable(commandWithArguments, exePath))
{
    throw new InvalidOperationException("Quoted command with arguments should match its executable path.");
}

if (!StartupService.IsRunCommandForExecutable(startupCommand, exePath))
{
    throw new InvalidOperationException("Default startup command should match its executable path.");
}

if (!StartupService.IsRunCommandForExecutable(command.ToUpperInvariant(), exePath.ToLowerInvariant()))
{
    throw new InvalidOperationException("Startup command matching should be case-insensitive on Windows paths.");
}

var oldExePath = @"C:\Old\EISCore.Collector.exe";
if (StartupService.IsRunCommandForExecutable($"\"{oldExePath}\"", exePath))
{
    throw new InvalidOperationException("Old startup path should not be treated as enabled for the current executable.");
}

if (StartupService.IsRunCommandForExecutable("", exePath)
    || StartupService.IsRunCommandForExecutable(command, "")
    || StartupService.IsRunCommandForExecutable("   ", exePath))
{
    throw new InvalidOperationException("Blank startup commands or executable paths should not match.");
}

if (StartupService.BuildRunCommand("") != "")
{
    throw new InvalidOperationException("Blank executable path should not create a startup command.");
}

ExpectMinimized(true, new[] { "--minimized" }, "--minimized should start hidden");
ExpectMinimized(true, new[] { "--from-startup" }, "--from-startup should start hidden");
ExpectMinimized(true, new[] { "/minimized" }, "/minimized should start hidden");
ExpectMinimized(true, new[] { "--MINIMIZED" }, "minimized argument should be case-insensitive");
ExpectMinimized(true, new[] { "--foreground", "--from-startup" }, "startup marker should start hidden even with other args");
ExpectMinimized(false, Array.Empty<string>(), "no arguments should show the main window");
ExpectMinimized(false, new[] { "--foreground" }, "unrelated arguments should show the main window");
ExpectMinimized(false, null, "null arguments should show the main window");

var appliedValues = new List<bool>();
var enableResult = CollectorAutoStartPolicy.Apply(false, true, value => appliedValues.Add(value));
if (!enableResult.Applied
    || !enableResult.Changed
    || !enableResult.HasRemoteSetting
    || !enableResult.RequestedEnabled
    || appliedValues.Count != 1
    || appliedValues[0] != true)
{
    throw new InvalidOperationException("Auto-start policy should apply changed remote enable requests.");
}

var unchangedResult = CollectorAutoStartPolicy.Apply(true, true, _ => throw new InvalidOperationException("setter should not be called"));
if (!unchangedResult.Applied || unchangedResult.Changed || !unchangedResult.RequestedEnabled)
{
    throw new InvalidOperationException("Auto-start policy should not call the setter when the requested value is already current.");
}

var missingResult = CollectorAutoStartPolicy.Apply(true, null, _ => throw new InvalidOperationException("setter should not be called"));
if (!missingResult.Applied || missingResult.Changed || missingResult.HasRemoteSetting || !missingResult.RequestedEnabled)
{
    throw new InvalidOperationException("Auto-start policy should ignore missing remote settings.");
}

var failureResult = CollectorAutoStartPolicy.Apply(false, true, _ => throw new UnauthorizedAccessException("registry denied"));
if (failureResult.Applied
    || failureResult.Changed
    || failureResult.Exception is not UnauthorizedAccessException
    || !failureResult.FailureSignature.Contains("UnauthorizedAccessException", StringComparison.Ordinal)
    || !failureResult.FailureSignature.Contains("registry denied", StringComparison.Ordinal))
{
    throw new InvalidOperationException("Auto-start policy should surface registry failures without reporting a config change.");
}

var readActualEnabled = CollectorAutoStartPolicy.ReadConfiguredState(false, () => true);
if (!readActualEnabled.ReadSucceeded || !readActualEnabled.IsEnabled || readActualEnabled.Exception is not null)
{
    throw new InvalidOperationException("Auto-start read policy should use the current Run entry when local config is disabled.");
}

var readConfiguredEnabled = CollectorAutoStartPolicy.ReadConfiguredState(true, () => throw new InvalidOperationException("reader should not be called"));
if (!readConfiguredEnabled.ReadSucceeded || !readConfiguredEnabled.IsEnabled)
{
    throw new InvalidOperationException("Auto-start read policy should trust enabled local config without reading the registry.");
}

var readFailure = CollectorAutoStartPolicy.ReadConfiguredState(false, () => throw new UnauthorizedAccessException("registry read denied"));
if (readFailure.ReadSucceeded || readFailure.IsEnabled || readFailure.Exception is not UnauthorizedAccessException)
{
    throw new InvalidOperationException("Auto-start read policy should fall back to local config when registry read fails.");
}

static void ExpectMinimized(bool expected, IEnumerable<string>? arguments, string message)
{
    var actual = StartupService.ShouldStartMinimized(arguments);
    if (actual != expected)
    {
        throw new InvalidOperationException($"{message}: expected {expected}, got {actual}.");
    }
}
`)

try {
  const result = spawnSync(dotnet, ['run', '--project', project], {
    cwd: repoRoot,
    encoding: 'utf8'
  })

  if (result.status !== 0) {
    console.error(result.stdout)
    console.error(result.stderr)
    process.exit(result.status || 1)
  }

  console.log('PASS: collector startup service regression')
} finally {
  rmSync(workDir, { recursive: true, force: true })
}
