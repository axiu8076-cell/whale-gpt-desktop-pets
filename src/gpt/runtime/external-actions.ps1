function Initialize-ExternalActions {
  $script:actionFrames=@{};$script:actionState='idle';$script:actionFrame=0;$script:actionDeadline=0L
  $script:workingBag=@();$script:manualActionUntil=0L;$script:manualAction=$null;$script:activityWorker=$null;$script:lastActivityStart=0L
  $script:activity=$null;$script:activityStamp=0L;$script:activityEnabled=$true
  if($null-ne $settings.showActivity){$script:activityEnabled=[bool]$settings.showActivity}
  $sheet=[Windows.Media.Imaging.BitmapImage]::new()
  $sheet.BeginInit();$sheet.CacheOption=[Windows.Media.Imaging.BitmapCacheOption]::OnLoad
  $sheet.UriSource=[Uri](Join-Path $script:appDir 'assets\gpt-niang-actions.png');$sheet.EndInit();$sheet.Freeze()
  if($sheet.PixelWidth-ne 1536 -or $sheet.PixelHeight-ne 1872){throw 'Invalid GPT Niang action sheet'}
  foreach($entry in @(@{name='idle';row=0;count=6},@{name='thinking';row=6;count=6},@{name='running';row=7;count=6},@{name='waving';row=3;count=4},@{name='jump';row=4;count=5})){
    $frames=@()
    for($column=0;$column-lt $entry.count;$column++){
      $frame=[Windows.Media.Imaging.CroppedBitmap]::new($sheet,[Windows.Int32Rect]::new($column*192,$entry.row*208,192,208));$frame.Freeze()
      $alpha=[Windows.Media.Imaging.FormatConvertedBitmap]::new($frame,[Windows.Media.PixelFormats]::Bgra32,$null,0);$alpha.Freeze()
      $pixels=New-Object byte[] (192*208*4);$alpha.CopyPixels($pixels,192*4,0)
      $frames+=@{image=$frame;pixels=$pixels}
    }
    $script:actionFrames[$entry.name]=$frames
  }
  $script:ui.Girl.Stretch=[Windows.Media.Stretch]::Uniform
  $script:ui.Girl.Width=192;[Windows.Controls.Canvas]::SetLeft($script:ui.Girl,150)
  Set-ExternalActionFrame 0
  $script:activityCard=[Windows.Markup.XamlReader]::Parse(@'
<Border xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
 Width="340" Height="116" CornerRadius="18" Background="#FCFFFFFF" BorderBrush="#DFD3EB" BorderThickness="1.5" Padding="16,10" RenderTransformOrigin="0.5,0.5" Cursor="Hand">
 <StackPanel>
  <TextBlock x:Name="ActivityHeader" Text="客户端任务" FontSize="14" Foreground="#877294" Margin="0,0,0,7"/>
  <TextBlock x:Name="ActivityTitle" Text="正在读取任务…" FontWeight="SemiBold" FontSize="19" Foreground="#44364F" TextTrimming="CharacterEllipsis"/>
  <TextBlock x:Name="ActivityStatus" Text="点角色查看额度" FontSize="16" Foreground="#876A9D" Margin="0,5,0,0" TextTrimming="CharacterEllipsis"/>
 </StackPanel>
</Border>
'@)
  $script:activityHeader=$script:activityCard.FindName('ActivityHeader')
  $script:activityTitle=$script:activityCard.FindName('ActivityTitle')
  $script:activityStatus=$script:activityCard.FindName('ActivityStatus')
  [Windows.Controls.Canvas]::SetLeft($script:activityCard,5);[Windows.Controls.Canvas]::SetTop($script:activityCard,8)
  $script:ui.Root.Children.Insert(0,$script:activityCard)
  $script:activityCard.Add_MouseLeftButtonUp({param($sender,$event)Show-Quota;$event.Handled=$true})
  Update-ExternalActivity ([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
}
function Set-ExternalActionFrame([int]$Index){
  $frame=$script:actionFrames[$script:actionState][$Index]
  $script:bitmap=$frame.image;$script:ui.Girl.Source=$frame.image
  $script:alphaPixels=$frame.pixels;$script:alphaStride=192*4
}
function Preview-ExternalAction([string]$Action){
  $script:manualAction=$Action;$script:manualActionUntil=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()+16000
  $script:actionDeadline=0
}
function Update-ExternalActivity([long]$Now){
  $file=Join-Path $script:dataDir 'activity.json'
  try{
    $stamp=[IO.File]::GetLastWriteTimeUtc($file).Ticks
    if($stamp-ne $script:activityStamp){$script:activity=Get-Content -LiteralPath $file -Raw -Encoding UTF8 | ConvertFrom-Json;$script:activityStamp=$stamp}
  }catch{$script:activity=$null}
  $fresh=$script:activity -and $Now-[long]$script:activity.at-lt 12000 -and $Now-[long]$script:activity.at-ge 0
  $threads=@($script:activity.threads|Where-Object{$null-ne $_})
  $active=@($threads|Where-Object{$_.state-in @('running','thinking','waiting')})
  $clientOpen=[GptWidgetNative]::HasCodex()
  $script:activityAction='idle'
  if(!$clientOpen){$script:activityHeader.Text='客户端未运行';$script:activityTitle.Text='我在这里等你';$script:activityStatus.Text='打开客户端后自动显示任务'}
  elseif(!$fresh -or !$script:activity.ok){
    $script:activityHeader.Text='客户端任务';$script:activityTitle.Text='任务状态暂不可读取';$script:activityStatus.Text='等待本机记录更新…'
  }elseif($threads.Count-eq 0){
    $script:activityHeader.Text='客户端已打开';$script:activityTitle.Text='暂时没有任务';$script:activityStatus.Text='点角色查看额度'
  }else{
    $list=if($active.Count-gt 0){$active}else{$threads}
    $index=if($active.Count-gt 1){[int]([Math]::Floor($Now/6000)%$active.Count)}else{0}
    $selected=$list[$index]
    $script:activityHeader.Text=if($active.Count-gt 0){"客户端 · $($active.Count) 个任务进行中"+$(if($active.Count-gt 1){"  $($index+1)/$($active.Count)"}else{''})}else{'客户端 · 最近任务'}
    $script:activityTitle.Text=$selected.title;$script:activityStatus.Text=$selected.label
    $script:activityAction=if($selected.state-in @('running','thinking','waiting')){'working'}else{'idle'}
    $script:activityCard.ToolTip=($threads|ForEach-Object{"$($_.title)`n$($_.label)"})-join "`n`n"
    $script:ui.Girl.ToolTip=$selected.title+"`n"+$selected.label+"`n点角色看额度；拖动调整位置；右键切换动作"
  }
  $script:activityCard.RenderTransform=[Windows.Media.ScaleTransform]::new($(if($script:side-eq 'left'){-1.0}else{1.0}),1)
  if($script:buddyMessageUntil-gt $Now){$script:activityHeader.Text='鲸鲸来串门';$script:activityStatus.Text=$script:buddyMessage}
  $script:activityCard.Visibility=if($script:activityEnabled -and $script:collapsed){[Windows.Visibility]::Visible}else{[Windows.Visibility]::Hidden}
}
function Ensure-ExternalActivityWorker([long]$Now){
  if($env:WHALE_CLIENT_ACTIVITY-eq '0'){return}
  if($script:activityWorker -and !$script:activityWorker.HasExited){return}
  if($Now-$script:lastActivityStart-lt 10000){return}
  $script:lastActivityStart=$Now
  if($script:activityWorker){$script:activityWorker.Dispose()}
  $arguments=@(('"'+(Join-Path $script:appDir 'runtime\client-activity.mjs')+'"'),('"'+(Join-Path $script:dataDir 'activity.json')+'"'),[string]$PID)
  $script:activityWorker=Start-Process -FilePath $script:config.nodePath -ArgumentList $arguments -WindowStyle Hidden -PassThru
}
function Start-ExternalActions {
  $menu=[Windows.Controls.MenuItem]::new();$menu.Header='动作与任务';$menu.Style=$script:settingsMenuResources['SettingsItem']
  foreach($entry in @(@{label='工作中 · 随机敲电脑 / 叼笔';action='working'},@{label='恢复随任务自动切换';action='auto'})){
    $item=[Windows.Controls.MenuItem]::new();$item.Header=$entry.label;$item.Tag=$entry.action;$item.Style=$script:settingsMenuResources['SettingsItem']
    $item.Add_Click({param($sender,$event)if($sender.Tag-eq 'auto'){$script:manualActionUntil=0}else{Preview-ExternalAction $sender.Tag}})
    $null=$menu.Items.Add($item)
  }
  $toggle=[Windows.Controls.MenuItem]::new();$toggle.Header='显示客户端任务卡';$toggle.IsCheckable=$true;$toggle.IsChecked=$script:activityEnabled;$toggle.Style=$script:settingsMenuResources['SettingsItem']
  $toggle.Add_Click({param($sender,$event)$script:activityEnabled=$sender.IsChecked;Save-Settings;Update-ExternalActivity ([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())})
  $null=$menu.Items.Add($toggle);$script:context.Items.Insert(0,$menu)
  $script:activityCard.ContextMenu=$script:context
  $script:actionTimer=[Windows.Threading.DispatcherTimer]::new();$script:actionTimer.Interval=[TimeSpan]::FromMilliseconds(80)
  $script:actionTimer.Add_Tick({
    try{
      $now=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
      $target=if($script:manualActionUntil-gt $now){$script:manualAction}else{$script:activityAction}
      if(!$target){$target='idle'}
      if($target-eq 'working'){
        if($script:actionDeadline-eq 0 -or ($script:actionFrame-eq 0 -and $now-ge $script:actionDeadline)){
          if($script:workingBag.Count-eq 0){$script:workingBag=@('running','thinking') | Sort-Object {Get-Random}}
          $target=$script:workingBag[0];$script:workingBag=@($script:workingBag | Select-Object -Skip 1)
        }else{$target=$script:actionState}
      }else{$script:workingBag=@()}
      # Finish a complete gesture so short tool calls cannot cut off the faint.
      if($target-ne $script:actionState -and ($script:actionDeadline-eq 0 -or ($script:actionFrame-eq 0 -and $now-ge $script:actionDeadline))){$script:actionState=$target;$script:actionFrame=0;$script:actionDeadline=0}
      if($now-ge $script:actionDeadline){
        Set-ExternalActionFrame $script:actionFrame
        $durations=switch($script:actionState){'running'{@(240,160,160,350,500,1200)}'thinking'{@(600,480,600,700,600,700)}'waving'{@(350,300,350,500)}'jump'{@(200,220,300,220,400)}default{@(1000,400,150,200,500,900)}}
        $script:actionDeadline=$now+$durations[$script:actionFrame];$script:actionFrame=($script:actionFrame+1)%$script:actionFrames[$script:actionState].Count
      }
      $script:activityCard.Visibility=if($script:activityEnabled -and $script:collapsed){[Windows.Visibility]::Visible}else{[Windows.Visibility]::Hidden}
    }catch{[IO.File]::WriteAllText((Join-Path $script:dataDir 'actions-error.txt'),$_.Exception.ToString())}
  });$script:actionTimer.Start()
  Ensure-ExternalActivityWorker ([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
}
function Stop-ExternalActions {
  if($script:actionTimer){$script:actionTimer.Stop()}
  if($script:activityWorker){try{if(!$script:activityWorker.HasExited){$script:activityWorker.Kill()}}catch{};$script:activityWorker.Dispose();$script:activityWorker=$null}
}
