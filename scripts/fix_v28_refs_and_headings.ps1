param(
  [string]$InputDocx = 'C:\Users\Twist\Desktop\论文\主稿\毕业论文初稿v2.8_图表标题样式彻底统一版_2026-04-06.docx',
  [string]$OutputDocx = 'C:\Users\Twist\Desktop\论文\主稿\毕业论文初稿v2.8_引用补齐与标题统一版_2026-04-06.docx',
  [string]$ReportMd = 'C:\Users\Twist\Desktop\论文\清单说明\v2.8_引用补齐与标题统一说明_2026-04-06.md'
)

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.IO.Compression.FileSystem

function Get-ParagraphText {
  param($Paragraph, $ns)
  $texts = $Paragraph.SelectNodes('.//w:t', $ns)
  $buf = New-Object System.Text.StringBuilder
  foreach ($t in $texts) { [void]$buf.Append($t.InnerText) }
  $buf.ToString().Trim()
}

function Clear-ParagraphRuns {
  param($Paragraph, $ns)
  $runs = @($Paragraph.SelectNodes('./w:r', $ns))
  foreach ($run in $runs) { [void]$Paragraph.RemoveChild($run) }
  $hyperlinks = @($Paragraph.SelectNodes('./w:hyperlink', $ns))
  foreach ($node in $hyperlinks) { [void]$Paragraph.RemoveChild($node) }
}

function Set-ParagraphText {
  param($Paragraph, $Text, $ns)
  $doc = $Paragraph.OwnerDocument
  Clear-ParagraphRuns -Paragraph $Paragraph -ns $ns
  $run = $doc.CreateElement('w', 'r', $ns.LookupNamespace('w'))
  $t = $doc.CreateElement('w', 't', $ns.LookupNamespace('w'))
  if ($Text -match '^\s' -or $Text -match '\s$' -or $Text -match '  ') {
    $xmlNs = $doc.CreateAttribute('xml', 'space', 'http://www.w3.org/XML/1998/namespace')
    $xmlNs.Value = 'preserve'
    [void]$t.Attributes.Append($xmlNs)
  }
  $t.InnerText = $Text
  [void]$run.AppendChild($t)
  [void]$Paragraph.AppendChild($run)
}

function New-BodyParagraph {
  param($Document, $StyleId, $Text, $wNs)
  $p = $Document.CreateElement('w', 'p', $wNs)
  $pPr = $Document.CreateElement('w', 'pPr', $wNs)
  if ($StyleId) {
    $pStyle = $Document.CreateElement('w', 'pStyle', $wNs)
    $valAttr = $Document.CreateAttribute('w', 'val', $wNs)
    $valAttr.Value = $StyleId
    [void]$pStyle.Attributes.Append($valAttr)
    [void]$pPr.AppendChild($pStyle)
  }
  [void]$p.AppendChild($pPr)
  $r = $Document.CreateElement('w', 'r', $wNs)
  $t = $Document.CreateElement('w', 't', $wNs)
  $t.InnerText = $Text
  [void]$r.AppendChild($t)
  [void]$p.AppendChild($r)
  $p
}

function Insert-ParagraphBefore {
  param($TargetParagraph, $NewParagraph)
  [void]$TargetParagraph.ParentNode.InsertBefore($NewParagraph, $TargetParagraph)
}

function Ensure-ParentDir {
  param([string]$Path)
  $dir = Split-Path -Parent $Path
  if (-not (Test-Path -LiteralPath $dir)) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
  }
}

$tmpRoot = Join-Path $env:TEMP ('v28_fix_' + [guid]::NewGuid().ToString('N'))
$extractDir = Join-Path $tmpRoot 'docx'
New-Item -ItemType Directory -Force -Path $extractDir | Out-Null

try {
  Ensure-ParentDir $OutputDocx
  Ensure-ParentDir $ReportMd

  [System.IO.Compression.ZipFile]::ExtractToDirectory($InputDocx, $extractDir)

  $documentXml = Join-Path $extractDir 'word\document.xml'
  [xml]$doc = Get-Content -LiteralPath $documentXml -Raw -Encoding UTF8
  $ns = New-Object System.Xml.XmlNamespaceManager($doc.NameTable)
  $ns.AddNamespace('w', 'http://schemas.openxmlformats.org/wordprocessingml/2006/main')
  $wNs = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'

  $headingMap = [ordered]@{
    '第一章 绪论' = '1 绪论'
    '第二章 总体概述' = '2 总体概述'
    '第三章 系统需求分析' = '3 系统需求分析'
    '第四章 系统概要设计' = '4 系统概要设计'
    '第五章 数据库设计' = '5 数据库设计'
    '第六章 系统详细设计' = '6 系统详细设计'
    '第七章 系统实现' = '7 系统实现'
    '鸣谢' = '8 鸣谢'
    '参考文献' = '9 参考文献'
    '附录' = '10 附录'
  }

  $introMap = [ordered]@{
    '图1-1' = '为便于说明本设计从企业约束、需求分析到系统实现与验证的整体推进关系，研究思路与技术路线如图1-1所示。'
    '表5-1' = '为说明系统核心组织权限数据的基础结构，用户表的主要字段设计如表5-1所示。'
    '表5-2' = '为说明系统角色与权限分类的基础数据结构，角色表的主要字段设计如表5-2所示。'
    '表5-3' = '为说明用户与角色之间的关联方式，用户角色关联表的主要字段设计如表5-3所示。'
    '表5-4' = '为说明物料主数据在系统中的组织方式，物料主数据表的主要字段设计如表5-4所示。'
    '表5-5' = '为说明仓库基础信息的存储方式，仓库表的主要字段设计如表5-5所示。'
    '表5-6' = '为说明库存批次管理与保质期追踪的数据基础，库存批次表的主要字段设计如表5-6所示。'
    '表5-7' = '为说明库存收发流水的记录结构，库存流水表的主要字段设计如表5-7所示。'
    '表5-8' = '为说明应用中心中已注册应用的组织方式，应用注册表的主要字段设计如表5-8所示。'
    '表5-9' = '为说明流程运行过程中的实例数据结构，流程实例表的主要字段设计如表5-9所示。'
    '表6-4' = '为说明流程实例启动时的关键输入与处理逻辑，流程实例启动函数说明如表6-4所示。'
    '表6-5' = '为说明流程节点执行前的权限校验逻辑，流程节点执行权限判断函数说明如表6-5所示。'
    '表8-1' = '为验证登录与权限校验链路的正确性，本设计给出的测试用例如表8-1所示。'
    '表8-2' = '为验证人事管理模块的主要功能，本设计给出的测试用例如表8-2所示。'
    '表8-3' = '为验证物料与库存模块的主要功能，本设计给出的测试用例如表8-3所示。'
    '表8-4' = '为验证应用中心模块的主要功能，本设计给出的测试用例如表8-4所示。'
    '表8-5' = '为验证移动端模块的主要功能，本设计给出的测试用例如表8-5所示。'
    '表8-6' = '为验证流程与语义相关能力的主要功能，本设计给出的测试用例如表8-6所示。'
  }

  $bodyStyleCandidates = @('a3', '正文文本', '正文')
  $chosenBodyStyle = 'a3'

  $paragraphs = @($doc.SelectNodes('//w:body/w:p', $ns))
  $headingFixes = 0
  $controllerFixes = 0
  $insertedRefs = New-Object System.Collections.Generic.List[string]

  foreach ($p in $paragraphs) {
    $txt = Get-ParagraphText -Paragraph $p -ns $ns
    if ([string]::IsNullOrWhiteSpace($txt)) { continue }

    if ($headingMap.Contains($txt)) {
      Set-ParagraphText -Paragraph $p -Text $headingMap[$txt] -ns $ns
      $headingFixes++
      continue
    }

    if ($txt -match 'controller/service') {
      $newText = $txt -replace 'controller/service', '传统后端分层'
      if ($newText -ne $txt) {
        Set-ParagraphText -Paragraph $p -Text $newText -ns $ns
        $controllerFixes++
      }
    }
  }

  $paragraphs = @($doc.SelectNodes('//w:body/w:p', $ns))
  for ($i = 0; $i -lt $paragraphs.Count; $i++) {
    $p = $paragraphs[$i]
    $txt = Get-ParagraphText -Paragraph $p -ns $ns
    if ([string]::IsNullOrWhiteSpace($txt)) { continue }

    foreach ($label in $introMap.Keys) {
      if ($txt.StartsWith($label)) {
        $prevText = ''
        if ($i -gt 0) { $prevText = Get-ParagraphText -Paragraph $paragraphs[$i - 1] -ns $ns }
        if ($prevText -notmatch [regex]::Escape($label)) {
          $newP = New-BodyParagraph -Document $doc -StyleId $chosenBodyStyle -Text $introMap[$label] -wNs $wNs
          Insert-ParagraphBefore -TargetParagraph $p -NewParagraph $newP
          $insertedRefs.Add($label) | Out-Null
        }
        break
      }
    }
  }

  $settings = New-Object System.Xml.XmlWriterSettings
  $settings.Indent = $false
  $settings.Encoding = New-Object System.Text.UTF8Encoding($false)
  $writer = [System.Xml.XmlWriter]::Create($documentXml, $settings)
  $doc.Save($writer)
  $writer.Close()

  if (Test-Path -LiteralPath $OutputDocx) {
    Remove-Item -LiteralPath $OutputDocx -Force
  }

  $zipPath = $OutputDocx
  $archive = [System.IO.Compression.ZipFile]::Open($zipPath, [System.IO.Compression.ZipArchiveMode]::Create)
  try {
    Get-ChildItem -LiteralPath $extractDir -Recurse -File | ForEach-Object {
      $rel = $_.FullName.Substring($extractDir.Length + 1).Replace('\', '/')
      [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $_.FullName, $rel, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
    }
  }
  finally {
    $archive.Dispose()
  }

  $report = @()
  $report += '# v2.8 引用补齐与标题统一说明'
  $report += ''
  $report += ('生成时间：' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))
  $report += ''
  $report += '## 本轮处理'
  $report += ('- 一级标题文本统一：' + $headingFixes)
  $report += ('- `controller/service` 残留替换：' + $controllerFixes)
  $report += ('- 新增图表正文引入句：' + ($insertedRefs.Count))
  $report += ''
  $report += '## 新增正文引入句的图表'
  foreach ($label in $insertedRefs) { $report += ('- ' + $label) }
  $report += ''
  $report += '## 输出文件'
  $report += ('- ' + $OutputDocx)
  Set-Content -LiteralPath $ReportMd -Value ($report -join "`r`n") -Encoding UTF8
}
finally {
  if (Test-Path -LiteralPath $tmpRoot) {
    Remove-Item -LiteralPath $tmpRoot -Recurse -Force -ErrorAction SilentlyContinue
  }
}
