param(
    [Parameter(Mandatory=$true)][string]$Executable,
    [Parameter(Mandatory=$true)][string]$Output,
    [int]$TimeoutSeconds=180,
    [switch]$TransparentCompositor
)
$ErrorActionPreference='Stop'
$executablePath=(Resolve-Path -LiteralPath $Executable).Path
$outputRoot=[System.IO.Path]::GetFullPath($Output)
if (Test-Path -LiteralPath $outputRoot) { throw 'Use a fresh evidence output directory.' }
New-Item -ItemType Directory -Path $outputRoot | Out-Null
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class HiddenUnityReviewHost {
 [StructLayout(LayoutKind.Sequential)] public struct Rect { public int left,top,right,bottom; }
 [StructLayout(LayoutKind.Sequential)] struct Point { public int x,y; }
 [StructLayout(LayoutKind.Sequential)] struct Message { public IntPtr hwnd;public uint message;public UIntPtr wParam;public IntPtr lParam;public uint time;public Point point;public uint extra; }
 [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
 [DllImport("user32.dll")] public static extern int GetSystemMetrics(int index);
 [DllImport("user32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern IntPtr CreateWindowEx(uint exStyle,string className,string title,uint style,int x,int y,int width,int height,IntPtr parent,IntPtr menu,IntPtr instance,IntPtr param);
 [DllImport("user32.dll")] public static extern bool DestroyWindow(IntPtr window);
 [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr window);
 [DllImport("user32.dll")] static extern bool SetLayeredWindowAttributes(IntPtr window,uint key,byte alpha,uint flags);
 [DllImport("user32.dll")] static extern bool GetLayeredWindowAttributes(IntPtr window,out uint key,out byte alpha,out uint flags);
 [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr window,int show);
 [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll",EntryPoint="GetWindowLongW")] static extern int GetWindowLong(IntPtr window,int index);
 [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr window,out Rect rect);
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr window,out Rect rect);
 [DllImport("user32.dll")] public static extern uint GetDpiForWindow(IntPtr window);
 [DllImport("user32.dll")] static extern IntPtr GetWindowDpiAwarenessContext(IntPtr window);
 [DllImport("user32.dll")] static extern int GetAwarenessFromDpiAwarenessContext(IntPtr context);
 [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window,out uint process);
 [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr window,EnumProc callback,IntPtr parameter);
 delegate bool EnumProc(IntPtr window,IntPtr parameter);
 [DllImport("user32.dll")] static extern bool PeekMessage(out Message message,IntPtr window,uint first,uint last,uint remove);
 [DllImport("user32.dll")] static extern bool TranslateMessage(ref Message message);
 [DllImport("user32.dll")] static extern IntPtr DispatchMessage(ref Message message);
 public static IntPtr Create(int width,int height) { var result=CreateWindowEx(0x080800A0,"STATIC","Unity background review host",0x80000000,0,0,width,height,IntPtr.Zero,IntPtr.Zero,IntPtr.Zero,IntPtr.Zero);if(result==IntPtr.Zero)throw new Exception("Create hidden host failed: "+Marshal.GetLastWin32Error());if(!SetLayeredWindowAttributes(result,0,0,2))throw new Exception("Set invisible host alpha failed");return result; }
 public static bool IsTransparent(IntPtr window) { uint key,flags;byte alpha;return GetLayeredWindowAttributes(window,out key,out alpha,out flags)&&alpha==0&&(flags&2)!=0&&(GetWindowLong(window,-20)&0x08080020)==0x08080020; }
 public static void ComposeInvisible(IntPtr window,IntPtr child) { if(!IsTransparent(window))throw new Exception("Host must be alpha-zero and nonactivating before composition");ShowWindow(child,4);ShowWindow(window,4); }
 public static bool OwnsForeground(int process) { uint owner;GetWindowThreadProcessId(GetForegroundWindow(),out owner);return owner==process; }
 public static void Pump() { Message message;while(PeekMessage(out message,IntPtr.Zero,0,0,1)){TranslateMessage(ref message);DispatchMessage(ref message);} }
 public static IntPtr ChildForProcess(IntPtr parent,int process) { IntPtr result=IntPtr.Zero; EnumChildWindows(parent,(window,parameter)=>{uint candidate;GetWindowThreadProcessId(window,out candidate);if(candidate==process){result=window;return false;}return true;},IntPtr.Zero);return result; }
 public static object Describe(IntPtr window) { Rect client,bounds;GetClientRect(window,out client);GetWindowRect(window,out bounds);return new { hwnd=window.ToInt64(),visible=IsWindowVisible(window),dpi=GetDpiForWindow(window),awareness=GetAwarenessFromDpiAwarenessContext(GetWindowDpiAwarenessContext(window)),clientWidth=client.right-client.left,clientHeight=client.bottom-client.top,windowLeft=bounds.left,windowTop=bounds.top,windowWidth=bounds.right-bounds.left,windowHeight=bounds.bottom-bounds.top }; }
}
'@
$priorDpi=[HiddenUnityReviewHost]::SetThreadDpiAwarenessContext([IntPtr]::new(-4))
$hostWindow=[IntPtr]::Zero
$reviewProcess=$null
$started=[DateTime]::UtcNow
$timedOut=$false
$childRecord=$null
$childSamples=[System.Collections.Generic.List[object]]::new()
$lastChildGeometry=''
$composed=$false
try {
    # This is the current physical primary desktop client size, not a test-size sweep.
    $width=[HiddenUnityReviewHost]::GetSystemMetrics(0)
    $height=[HiddenUnityReviewHost]::GetSystemMetrics(1)
    $hostWindow=[HiddenUnityReviewHost]::Create($width,$height)
    if ([HiddenUnityReviewHost]::IsWindowVisible($hostWindow)) { throw 'Review host unexpectedly visible.' }
    $hostRecord=[HiddenUnityReviewHost]::Describe($hostWindow)
    $reviewProcess=Start-Process -FilePath $executablePath -WorkingDirectory ([IO.Path]::GetDirectoryName($executablePath)) -ArgumentList @(
        '-parentHWND',$hostWindow.ToInt64().ToString(),
        '-screen-fullscreen','0','-screen-width',$width.ToString(),'-screen-height',$height.ToString(),
        '-logFile',('"'+(Join-Path $outputRoot 'player.log')+'"'),
        '--sdt-background-review',('"'+$outputRoot+'"')
    ) -WindowStyle Hidden -PassThru
    Write-Output ('Background embedded Unity PID '+$reviewProcess.Id+'; '+$width+'x'+$height)
    while (-not $reviewProcess.WaitForExit(25)) {
        [HiddenUnityReviewHost]::Pump()
        if(-not [HiddenUnityReviewHost]::IsTransparent($hostWindow)){throw 'Background host lost zero alpha or nonactivation style.'}
        if([HiddenUnityReviewHost]::OwnsForeground($reviewProcess.Id)){throw 'Review unexpectedly acquired foreground.'}
        $compositorChild=[HiddenUnityReviewHost]::ChildForProcess($hostWindow,$reviewProcess.Id)
        if($TransparentCompositor -and -not $composed -and $compositorChild -ne [IntPtr]::Zero -and (Test-Path -LiteralPath (Join-Path $outputRoot 'player.log'))){
            $startupLog=Get-Content -LiteralPath (Join-Path $outputRoot 'player.log') -Raw -ErrorAction SilentlyContinue
            if($startupLog -like '*[[]startup[]] playing*'){
                [HiddenUnityReviewHost]::ComposeInvisible($hostWindow,$compositorChild);$composed=$true
            }
        }
        $childWindow=[HiddenUnityReviewHost]::ChildForProcess($hostWindow,$reviewProcess.Id)
        if ($childWindow -ne [IntPtr]::Zero) {
            $childRecord=[HiddenUnityReviewHost]::Describe($childWindow)
            if ($childRecord.visible -and -not $composed) { throw 'Embedded review child unexpectedly visible.' }
            $childGeometry=$childRecord | ConvertTo-Json -Compress
            if ($childGeometry -ne $lastChildGeometry) {
                $childSamples.Add([pscustomobject]@{seconds=([DateTime]::UtcNow-$started).TotalSeconds;window=$childRecord})
                $lastChildGeometry=$childGeometry
            }
        }
        if (([DateTime]::UtcNow-$started).TotalSeconds -gt $TimeoutSeconds) {
            $timedOut=$true
            $reviewProcess.Kill();$reviewProcess.WaitForExit();break
        }
    }
    $reviewProcess.Refresh()
    $summary=[ordered]@{ executable=$executablePath;executableSha256=(Get-FileHash -LiteralPath $executablePath -Algorithm SHA256).Hash.ToLowerInvariant();pid=$reviewProcess.Id;startedAt=$started.ToString('o');endedAt=[DateTime]::UtcNow.ToString('o');exitCode=$reviewProcess.ExitCode;timedOut=$timedOut;host=$hostRecord;child=$childRecord;childGeometryChanges=$childSamples;transparentCompositor=$composed;zeroAlphaAndNonactivating=[HiddenUnityReviewHost]::IsTransparent($hostWindow);input='No OS input; zero-alpha nonactivating click-through parent HWND; standalone backbuffer at current physical primary desktop size';output=$outputRoot }
    $summary | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $outputRoot 'process.json') -Encoding UTF8
    $summary | ConvertTo-Json -Depth 6
    if ($timedOut -or $reviewProcess.ExitCode -ne 0) { exit 2 }
}
finally {
    if ($null -ne $reviewProcess -and -not $reviewProcess.HasExited) { $reviewProcess.Kill();$reviewProcess.WaitForExit() }
    if ($hostWindow -ne [IntPtr]::Zero) { $null=[HiddenUnityReviewHost]::DestroyWindow($hostWindow) }
    $null=[HiddenUnityReviewHost]::SetThreadDpiAwarenessContext($priorDpi)
}
