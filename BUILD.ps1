$ErrorActionPreference = 'Stop'
$gameRoot = $PSScriptRoot
$outputZip = Join-Path (Split-Path -Parent $gameRoot) 'PROJECT-TOUCHLINE-Windows.zip'
$temporaryZip = Join-Path (Split-Path -Parent $gameRoot) 'PROJECT-TOUCHLINE-Windows.building.zip'
$names = @('index.html','style.css','package.json','server.mjs','PLAY.cmd','README.md','COLLABORATION.md','CLAUDE.md','collaboration','.gitignore','.github','BUILD.ps1','vercel.json','.vercelignore','src','assets-source','vendor','tools','licenses','tests','reports','screenshots','server/worker.js','server/room.js','server/wrangler.jsonc')
$files = foreach ($name in $names) { $item = Get-Item -LiteralPath (Join-Path $gameRoot $name); if ($item.PSIsContainer) { Get-ChildItem -LiteralPath $item.FullName -Recurse -File | Where-Object { $_.Extension -ne '.log' } } else { $item } }
Add-Type -AssemblyName System.IO.Compression.FileSystem
$stream = [System.IO.File]::Open($temporaryZip,[System.IO.FileMode]::Create)
$archive = [System.IO.Compression.ZipArchive]::new($stream,[System.IO.Compression.ZipArchiveMode]::Create)
try { foreach ($file in $files) { if (!$file.FullName.StartsWith($gameRoot + [System.IO.Path]::DirectorySeparatorChar)) { throw 'Invalid bundle path' }; $entry = $file.FullName.Substring($gameRoot.Length + 1).Replace('\','/'); [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive,$file.FullName,$entry,[System.IO.Compression.CompressionLevel]::Optimal) | Out-Null } } finally { $archive.Dispose(); $stream.Dispose() }
Move-Item -LiteralPath $temporaryZip -Destination $outputZip -Force
Write-Output $outputZip
